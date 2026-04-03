export type ProviderCategory = "ai-agent" | "terminal" | "browser" | "document";
export type ViewType = "terminal" | "webview" | "document";

export interface ProviderParam {
  key: string;
  label: string;
  type: "string" | "select" | "boolean";
  options?: { value: string; label: string }[];
  defaultValue?: string;
  argTemplate?: string;
}

export interface SessionManagement {
  newSessionArg: string;
  resumeArg: string;
  stalePatterns: string[];
}

export interface SessionProvider {
  id: string;
  name: string;
  icon: string;
  category: ProviderCategory;
  viewType: ViewType;
  command: string;
  fixedArgs?: string[];
  params: ProviderParam[];
  sessionManagement?: SessionManagement;
  isBuiltin: boolean;
  description?: string;
}

export const BUILTIN_PROVIDERS: SessionProvider[] = [
  {
    id: "claude-cli",
    name: "Claude Code",
    icon: "claude",
    category: "ai-agent",
    viewType: "terminal",
    command: "claude",
    params: [
      {
        key: "model",
        label: "Model",
        type: "select",
        options: [
          { value: "", label: "Default" },
          { value: "opus", label: "Opus" },
          { value: "sonnet", label: "Sonnet" },
        ],
        argTemplate: "--model {value}",
      },
      {
        key: "dangerously-skip-permissions",
        label: "Skip Permissions",
        type: "boolean",
        argTemplate: "--dangerously-skip-permissions",
      },
    ],
    sessionManagement: {
      newSessionArg: "--session-id",
      resumeArg: "--resume",
      stalePatterns: ["No conversation found", "Invalid session"],
    },
    isBuiltin: true,
    description: "Anthropic Claude Code CLI",
  },
  {
    id: "codex-cli",
    name: "Codex",
    icon: "codex",
    category: "ai-agent",
    viewType: "terminal",
    command: "codex",
    params: [
      {
        key: "model",
        label: "Model",
        type: "string",
        argTemplate: "--model {value}",
      },
      {
        key: "approval-mode",
        label: "Approval Mode",
        type: "select",
        options: [
          { value: "suggest", label: "Suggest" },
          { value: "auto-edit", label: "Auto Edit" },
          { value: "full-auto", label: "Full Auto" },
        ],
        defaultValue: "suggest",
        argTemplate: "--approval-mode {value}",
      },
    ],
    isBuiltin: true,
    description: "OpenAI Codex CLI",
  },
  {
    id: "cursor-cli",
    name: "Cursor Agent",
    icon: "cursor",
    category: "ai-agent",
    viewType: "terminal",
    command: "cursor-agent",
    params: [
      {
        key: "model",
        label: "Model",
        type: "string",
        argTemplate: "--model {value}",
      },
    ],
    isBuiltin: true,
    description: "Cursor Agent CLI",
  },
  {
    id: "terminal",
    name: "原生终端",
    icon: "terminal",
    category: "terminal",
    viewType: "terminal",
    command: "",
    params: [
      {
        key: "shell",
        label: "Shell",
        type: "select",
        options: navigator.platform.includes("Mac")
          ? [
              { value: "", label: "系统默认" },
              { value: "/bin/zsh", label: "zsh" },
              { value: "/bin/bash", label: "bash" },
              { value: "/bin/fish", label: "fish" },
            ]
          : [
              { value: "", label: "系统默认" },
              { value: "powershell", label: "PowerShell" },
              { value: "cmd", label: "CMD" },
              { value: "wsl", label: "WSL" },
              { value: "git-bash", label: "Git Bash" },
            ],
      },
    ],
    isBuiltin: true,
    description: "Native system terminal",
  },
];

export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  "ai-agent": "AI Agents",
  terminal: "终端",
  browser: "浏览器",
  document: "文档",
};

export const DEFAULT_PROVIDER_ID = "claude-cli";
