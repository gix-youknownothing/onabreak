import {
  BUILTIN_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  type ProviderCategory,
  type SessionProvider,
} from "./providers";

const IS_WINDOWS = navigator.userAgent.includes("Windows");
const IS_MAC = navigator.platform.includes("Mac");

function getDefaultShell(): string {
  if (IS_WINDOWS) return "powershell.exe";
  if (IS_MAC) return "/bin/zsh";
  return "/bin/bash";
}

class ProviderRegistry {
  private providers = new Map<string, SessionProvider>();
  private _defaultProviderId: string = DEFAULT_PROVIDER_ID;
  private _quickProviderIds: string[] = ["claude-cli", "terminal"];

  registerBuiltins() {
    for (const p of BUILTIN_PROVIDERS) {
      this.providers.set(p.id, p);
    }
  }

  get(id: string): SessionProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): SessionProvider[] {
    return Array.from(this.providers.values());
  }

  getByCategory(category: ProviderCategory): SessionProvider[] {
    return this.getAll().filter((p) => p.category === category);
  }

  getDefault(): SessionProvider {
    return this.providers.get(this._defaultProviderId) ?? BUILTIN_PROVIDERS[0];
  }

  setDefaultProviderId(id: string) {
    this._defaultProviderId = this.providers.has(id) ? id : DEFAULT_PROVIDER_ID;
  }

  getDefaultProviderId(): string {
    return this._defaultProviderId;
  }

  getQuickList(): SessionProvider[] {
    return this._quickProviderIds
      .map((id) => this.providers.get(id))
      .filter((p): p is SessionProvider => !!p);
  }

  setQuickProviderIds(ids: string[]) {
    this._quickProviderIds = ids.filter((id) => this.providers.has(id));
  }

  getQuickProviderIds(): string[] {
    return [...this._quickProviderIds];
  }

  buildSpawnArgs(
    provider: SessionProvider,
    opts: {
      sessionConfig: Record<string, any>;
    },
  ): { file: string; args: string[] } {
    const args: string[] = [...(provider.fixedArgs || [])];

    for (const param of provider.params) {
      const value = opts.sessionConfig[param.key];
      if (value === undefined || value === null || value === "") continue;

      if (param.type === "boolean" && value === true && param.argTemplate) {
        args.push(param.argTemplate);
      } else if (param.argTemplate && typeof value === "string" && value) {
        args.push(...expandArgTemplate(param.argTemplate, value));
      }
    }

    let file = provider.command;
    let finalArgs = args;

    if (!file) {
      const shell = (opts.sessionConfig.shell as string) || "";
      if (shell === "git-bash") {
        file = IS_WINDOWS
          ? "C:\\Program Files\\Git\\bin\\bash.exe"
          : "/bin/bash";
      } else if (shell) {
        file = shell;
      } else {
        file = getDefaultShell();
      }
      finalArgs = [];
    } else if (IS_WINDOWS) {
      finalArgs = ["/C", file, ...args];
      file = "cmd.exe";
    } else if (IS_MAC) {
      // On macOS, spawn the command directly without shell wrapping
      finalArgs = args;
    }

    return { file, args: finalArgs };
  }
}

/** Expand `argTemplate` with `{value}` so values containing spaces stay a single argv entry. */
function expandArgTemplate(template: string, value: string): string[] {
  const marker = "{value}";
  const i = template.indexOf(marker);
  if (i === -1) {
    const t = template.trim();
    return t ? t.split(/\s+/).filter(Boolean) : [];
  }
  const before = template.slice(0, i).trim();
  const after = template.slice(i + marker.length).trim();
  const out: string[] = [];
  if (before) out.push(...before.split(/\s+/).filter(Boolean));
  out.push(value);
  if (after) out.push(...after.split(/\s+/).filter(Boolean));
  return out;
}

export const providerRegistry = new ProviderRegistry();

providerRegistry.registerBuiltins();
