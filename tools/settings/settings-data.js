/* Catalogue of Claude Code settings.json keys.
 *
 * Source: code.claude.com/docs/en/settings, verified against Claude Code 2.1.220.
 * Each entry:
 *   key       dotted path as it appears in settings.json
 *   type      boolean | string | number | string[] | object | object[]
 *   def       documented default, or null when there is none
 *   group     section heading in the UI
 *   desc      one line, in the user's terms
 *   values    for enums: the allowed values
 *   managed   true when the setting only applies from a managed/enterprise file
 *   since     minimum Claude Code version, when the docs state one
 *   live      "reload" if it is picked up live, "restart" if it is read once at startup
 *   example   a sensible value to seed the builder with
 */
(function (global) {
  'use strict';

  var SETTINGS = [
    // ---- model ----
    { key: 'model', type: 'string', def: null, group: 'Model', live: 'restart',
      desc: 'Model for the session. Read at startup — use /model to change mid-session.',
      example: 'opus' },
    { key: 'effortLevel', type: 'string', def: null, group: 'Model',
      values: ['low', 'medium', 'high', 'xhigh'],
      desc: 'Persist a reasoning effort level instead of picking one each session.',
      example: 'high' },
    { key: 'availableModels', type: 'string[]', def: null, group: 'Model',
      desc: 'Restrict which models can be selected, for sessions, subagents and skills.',
      example: ['opus', 'sonnet'] },
    { key: 'enforceAvailableModels', type: 'boolean', def: false, group: 'Model', since: '2.1.175',
      desc: 'Apply the availableModels allowlist to the Default model as well.' },
    { key: 'fallbackModel', type: 'string[]', def: null, group: 'Model',
      desc: 'Models to fall back to, in order. Maximum three; "default" expands to the default model.',
      example: ['sonnet'] },
    { key: 'advisorModel', type: 'string', def: null, group: 'Model',
      desc: 'Model for the server-side advisor tool.', example: 'sonnet' },
    { key: 'fastMode', type: 'boolean', def: false, group: 'Model',
      desc: 'Start every session in fast mode.' },
    { key: 'fastModePerSessionOptIn', type: 'boolean', def: false, group: 'Model',
      desc: 'Require fast mode to be turned on per session rather than inheriting it.' },
    { key: 'alwaysThinkingEnabled', type: 'boolean', def: false, group: 'Model',
      desc: 'Turn extended thinking on by default.' },

    // ---- interface ----
    { key: 'outputStyle', type: 'string', def: null, group: 'Interface', live: 'restart',
      desc: 'Output style to use. Read at startup — /clear rebuilds it.', example: 'Concise' },
    { key: 'statusLine', type: 'object', def: null, group: 'Interface',
      desc: 'Custom status line. Build one with the status line tool.',
      example: { type: 'command', command: 'bash ~/.claude/statusline-command.sh' },
      link: '../statusline/' },
    { key: 'tui', type: 'boolean', def: true, group: 'Interface',
      desc: 'Use the fullscreen TUI. Turn it off for plain scrolling output.' },
    { key: 'editorMode', type: 'string', def: 'normal', group: 'Interface',
      values: ['normal', 'vim'], desc: 'Key bindings in the prompt.', example: 'vim' },
    { key: 'spinnerTipsEnabled', type: 'boolean', def: true, group: 'Interface',
      desc: 'Show tips in the spinner while you wait.' },
    { key: 'autoScrollEnabled', type: 'boolean', def: true, group: 'Interface',
      desc: 'Follow the output to the bottom in fullscreen mode.' },
    { key: 'awaySummaryEnabled', type: 'boolean', def: true, group: 'Interface',
      desc: 'Recap what happened when you come back after being idle.' },
    { key: 'emojiCompletionEnabled', type: 'boolean', def: true, group: 'Interface', since: '2.1.217',
      desc: 'Complete :shortcode: emoji as you type.' },
    { key: 'axScreenReader', type: 'boolean', def: false, group: 'Interface', since: '2.1.181',
      desc: 'Render flat text that a screen reader can follow.' },
    { key: 'defaultShell', type: 'string', def: 'bash', group: 'Interface',
      desc: 'Shell used for ! commands. Defaults to powershell on Windows.', example: 'zsh' },

    // ---- context ----
    { key: 'autoCompactEnabled', type: 'boolean', def: true, group: 'Context',
      desc: 'Compact the conversation automatically as it approaches the context limit.' },
    { key: 'autoMemoryEnabled', type: 'boolean', def: true, group: 'Context',
      desc: 'Let Claude read and write its own memory files.' },
    { key: 'autoMemoryDirectory', type: 'string', def: null, group: 'Context',
      desc: 'Where auto memory lives. Absolute, or starting with ~/.',
      example: '~/.claude/memory' },
    { key: 'claudeMdExcludes', type: 'string[]', def: null, group: 'Context',
      desc: 'Glob patterns of CLAUDE.md files to ignore.',
      example: ['**/vendor/**/CLAUDE.md'] },
    { key: 'cleanupPeriodDays', type: 'number', def: 30, group: 'Context',
      desc: 'How many days of session files to keep. Minimum 1.', example: 60 },
    { key: 'fileCheckpointingEnabled', type: 'boolean', def: true, group: 'Context', since: '2.1.119',
      desc: 'Snapshot files before edits so /rewind can undo them.' },

    // ---- permissions ----
    { key: 'permissions.allow', type: 'string[]', def: null, group: 'Permissions', live: 'reload',
      desc: 'Tool patterns to approve without asking.',
      example: ['Bash(npm run test:*)', 'Read(~/.zshrc)'] },
    { key: 'permissions.deny', type: 'string[]', def: null, group: 'Permissions', live: 'reload',
      desc: 'Tool patterns to reject outright. Deny wins over allow.',
      example: ['Read(./.env)', 'Read(./secrets/**)', 'Bash(curl:*)'] },
    { key: 'permissions.ask', type: 'string[]', def: null, group: 'Permissions', live: 'reload',
      desc: 'Tool patterns to always prompt for, even if something else would allow them.',
      example: ['Bash(git push:*)'] },
    { key: 'permissions.defaultMode', type: 'string', def: 'ask', group: 'Permissions', live: 'reload',
      values: ['ask', 'auto', 'allow'],
      desc: 'What happens to a request no rule matches.', example: 'ask' },
    { key: 'permissions.additionalDirectories', type: 'string[]', def: null, group: 'Permissions', live: 'reload',
      desc: 'Extra directories Claude may read and write outside the project.',
      example: ['/srv/shared'] },
    { key: 'permissions.disableBypassPermissionsMode', type: 'boolean', def: false,
      group: 'Permissions', managed: true,
      desc: 'Stop anyone switching to bypass-permissions mode.' },
    { key: 'allowManagedPermissionRulesOnly', type: 'boolean', def: false,
      group: 'Permissions', managed: true,
      desc: 'Ignore user and project permission rules; only managed ones apply.' },
    { key: 'disableAutoMode', type: 'string', def: null, group: 'Permissions',
      values: ['disable'], desc: 'Set to "disable" to stop auto mode being used at all.',
      example: 'disable' },
    { key: 'autoMode', type: 'object', def: null, group: 'Permissions',
      desc: 'Override the auto-mode classifier rules. Use "$defaults" to keep the built-in list.',
      example: { deny: ['$defaults', 'Bash(rm:*)'] } },
    { key: 'autoMode.classifyAllShell', type: 'boolean', def: false, group: 'Permissions', since: '2.1.193',
      desc: 'Send every shell command through the classifier, not just unmatched ones.' },
    { key: 'askUserQuestionTimeout', type: 'string', def: 'never', group: 'Permissions',
      values: ['60s', '5m', '10m', 'never'],
      desc: 'How long a question waits before Claude carries on by itself.', example: '5m' },

    // ---- hooks ----
    { key: 'hooks', type: 'object', def: null, group: 'Hooks', live: 'reload',
      desc: 'Commands Claude Code runs on its own events.',
      example: { configChange: { type: 'bash', command: "echo 'settings changed'" } } },
    { key: 'disableAllHooks', type: 'boolean', def: false, group: 'Hooks',
      desc: 'Turn every hook off — this disables your custom status line too.' },
    { key: 'allowManagedHooksOnly', type: 'boolean', def: false, group: 'Hooks', managed: true,
      desc: 'Only run managed, SDK or force-enabled hooks.' },
    { key: 'allowedHttpHookUrls', type: 'string[]', def: null, group: 'Hooks',
      desc: 'URL patterns HTTP hooks may call. Merged across every settings scope.',
      example: ['https://hooks.example.com/**'] },

    // ---- mcp ----
    { key: 'enableAllProjectMcpServers', type: 'boolean', def: false, group: 'MCP',
      desc: 'Approve every server in the project .mcp.json without prompting.' },
    { key: 'enabledMcpjsonServers', type: 'string[]', def: null, group: 'MCP',
      desc: 'Approve just these servers from .mcp.json.', example: ['memory'] },
    { key: 'disabledMcpjsonServers', type: 'string[]', def: null, group: 'MCP',
      desc: 'Block these servers from .mcp.json.', example: ['legacy-api'] },
    { key: 'disableClaudeAiConnectors', type: 'boolean', def: false, group: 'MCP', since: '2.1.182',
      desc: 'Do not load MCP connectors configured on claude.ai.' },
    { key: 'allowedMcpServers', type: 'object[]', def: null, group: 'MCP', managed: true,
      desc: 'The only MCP servers permitted.' },
    { key: 'deniedMcpServers', type: 'object[]', def: null, group: 'MCP', managed: true,
      desc: 'MCP servers that are always blocked.' },
    { key: 'allowManagedMcpServersOnly', type: 'boolean', def: false, group: 'MCP', managed: true,
      desc: 'Ignore every server that is not on the managed allowlist.' },
    { key: 'allowAllClaudeAiMcps', type: 'boolean', def: null, group: 'MCP', managed: true,
      desc: 'Load claude.ai connectors alongside managed-mcp.json.' },

    // ---- skills, plugins, agents ----
    { key: 'plugins', type: 'object', def: null, group: 'Plugins and skills',
      desc: 'Which plugins are enabled.' },
    { key: 'disableBundledSkills', type: 'boolean', def: false, group: 'Plugins and skills',
      desc: 'Turn off the built-in skills and workflows. Your own still load.' },
    { key: 'disableWorkflows', type: 'boolean', def: false, group: 'Plugins and skills',
      desc: 'Turn off dynamic workflows and the bundled commands.' },
    { key: 'disableSkillShellExecution', type: 'boolean', def: false,
      group: 'Plugins and skills', managed: true,
      desc: 'Stop skills and commands running inline shell.' },
    { key: 'strictKnownMarketplaces', type: 'boolean', def: false,
      group: 'Plugins and skills', managed: true,
      desc: 'Only install plugins from known or deployed marketplaces.' },
    { key: 'blockedMarketplaces', type: 'object[]', def: null,
      group: 'Plugins and skills', managed: true, desc: 'Marketplace sources to refuse.' },
    { key: 'allowedChannelPlugins', type: 'object[]', def: null,
      group: 'Plugins and skills', managed: true, desc: 'The only channel plugins permitted.' },
    { key: 'agent', type: 'string', def: null, group: 'Plugins and skills',
      desc: 'Run the main thread as a named subagent.', example: 'code-reviewer' },
    { key: 'disableAgentView', type: 'boolean', def: false, group: 'Plugins and skills',
      desc: 'Turn off background agents and the agent view.' },
    { key: 'disableSideloadFlags', type: 'boolean', def: false,
      group: 'Plugins and skills', since: '2.1.193',
      desc: 'Reject --plugin-dir, --plugin-url, --agents and --mcp-config.' },

    // ---- auth ----
    { key: 'apiKeyHelper', type: 'string', def: null, group: 'Authentication', live: 'reload',
      desc: 'Shell command that prints an auth token. Refresh interval comes from CLAUDE_CODE_API_KEY_HELPER_TTL_MS.',
      example: '/usr/local/bin/claude-token' },
    { key: 'forceLoginMethod', type: 'string', def: null, group: 'Authentication',
      values: ['oauth', 'sso', 'apiKey', 'bedrock'],
      desc: 'Skip the login picker and always use this method.', example: 'oauth' },
    { key: 'forceLoginOrgUUID', type: 'string', def: null, group: 'Authentication', managed: true,
      desc: 'Only allow logging in to this organisation.' },
    { key: 'awsCredentialExport', type: 'string', def: null, group: 'Authentication',
      desc: 'Script that prints AWS credentials as JSON.' },
    { key: 'awsAuthRefresh', type: 'string', def: null, group: 'Authentication',
      desc: 'Script that refreshes the .aws directory.' },

    // ---- artifacts, browser, remote ----
    { key: 'enableArtifact', type: 'boolean', def: null, group: 'Artifacts and browser', since: '2.1.196',
      desc: 'Turn the Artifact tool on or off explicitly.' },
    { key: 'disableArtifact', type: 'boolean', def: false, group: 'Artifacts and browser',
      desc: 'Stop Artifacts being published to claude.ai.' },
    { key: 'browserExternalPageTools', type: 'string', def: null,
      group: 'Artifacts and browser', managed: true, values: ['disabled'],
      desc: 'Set to "disabled" to block tools that act on external pages.', example: 'disabled' },
    { key: 'disableBrowserExternalNavigation', type: 'boolean', def: false,
      group: 'Artifacts and browser', managed: true,
      desc: 'Stop the Browser pane navigating to external sites.' },
    { key: 'disableRemoteControl', type: 'boolean', def: false,
      group: 'Artifacts and browser', since: '2.1.128',
      desc: 'Block the remote control feature.' },
    { key: 'agentPushNotifEnabled', type: 'boolean', def: false,
      group: 'Artifacts and browser', since: '2.1.119',
      desc: 'Push notifications to your phone while Remote Control is connected.' },
    { key: 'disableMobileSimulatorTools', type: 'boolean', def: false,
      group: 'Artifacts and browser', managed: true,
      desc: 'Block the iOS Simulator tools.' },
    { key: 'disableDeepLinkRegistration', type: 'string', def: null,
      group: 'Artifacts and browser', values: ['disable'],
      desc: 'Set to "disable" to stop registering the claude-cli:// protocol.', example: 'disable' },

    // ---- git ----
    { key: 'includeCoAuthoredBy', type: 'boolean', def: false, group: 'Git',
      desc: 'Add a Co-authored-by trailer to commits Claude makes.' },
    { key: 'attribution', type: 'object', def: null, group: 'Git',
      desc: 'Customise the attribution added to commits and pull requests.',
      example: { commit: false, pr: true } },

    // ---- environment ----
    { key: 'env', type: 'object', def: null, group: 'Environment',
      desc: 'Environment variables for every session and everything it spawns.',
      example: { DISABLE_AUTOUPDATER: '1' } },
    { key: 'autoUpdatesChannel', type: 'string', def: 'latest', group: 'Environment',
      values: ['latest', 'stable'], desc: 'Which release channel to update from.',
      example: 'stable' },
    { key: 'fileSuggestion', type: 'object', def: null, group: 'Environment',
      desc: 'Custom script backing @ file autocomplete.' },
    { key: 'companyAnnouncements', type: 'string[]', def: null,
      group: 'Environment', managed: true,
      desc: 'Messages shown at startup, picked at random.' },
    { key: 'claudeMd', type: 'string', def: null, group: 'Environment', managed: true,
      desc: 'Organisation-wide memory prepended for everyone.' },
    { key: 'feedbackSurveyRate', type: 'number', def: null, group: 'Environment',
      desc: 'Probability between 0 and 1 of being shown a survey.', example: 0 }
  ];

  var SCOPES = [
    { id: 'user', name: 'User', path: '~/.claude/settings.json',
      applies: 'You, in every project', shared: false,
      note: 'Where personal preferences belong: model, output style, status line.' },
    { id: 'project', name: 'Project', path: '.claude/settings.json',
      applies: 'Everyone working in this repository', shared: true,
      note: 'Committed to git. Team-wide permission rules and hooks go here.' },
    { id: 'local', name: 'Local', path: '.claude/settings.local.json',
      applies: 'You, in this repository only', shared: false,
      note: 'Gitignored. Your own overrides for one repo.' },
    { id: 'managed', name: 'Managed', path: 'managed-settings.json',
      applies: 'Everyone on the machine or in the org', shared: true,
      note: 'Deployed by IT. macOS /Library/Application Support/ClaudeCode/, ' +
            'Linux /etc/claude-code/, Windows C:\\Program Files\\ClaudeCode\\. Wins over everything.' }
  ];

  // highest priority first
  var PRECEDENCE = ['Managed', 'CLI arguments', 'Local', 'Project', 'User'];

  var ENV_VARS = [
    { name: 'CLAUDE_CODE_ENABLE_TELEMETRY', desc: 'Export telemetry.' },
    { name: 'CLAUDE_CODE_API_KEY_HELPER_TTL_MS', desc: 'How often apiKeyHelper is re-run.' },
    { name: 'CLAUDE_CODE_DISABLE_AUTO_MEMORY', desc: 'Turn auto memory off.' },
    { name: 'DISABLE_AUTO_COMPACT', desc: 'Turn auto-compacting off.' },
    { name: 'CLAUDE_CODE_SKIP_PROMPT_HISTORY', desc: 'Do not write transcripts.' },
    { name: 'CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING', desc: 'Turn /rewind checkpointing off.' },
    { name: 'CLAUDE_CODE_DISABLE_ARTIFACT', desc: 'Turn the Artifact tool off.' },
    { name: 'CLAUDE_CODE_DISABLE_AGENT_VIEW', desc: 'Turn the agent view off.' },
    { name: 'CLAUDE_CODE_DISABLE_BUNDLED_SKILLS', desc: 'Turn bundled skills off.' },
    { name: 'CLAUDE_CODE_DISABLE_WORKFLOWS', desc: 'Turn workflows off.' },
    { name: 'CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY', desc: 'Never show the survey.' },
    { name: 'CLAUDE_CODE_USE_POWERSHELL_TOOL', desc: 'Enable the PowerShell tool.' },
    { name: 'CLAUDE_CODE_DISABLE_REMOTE_CONTROL', desc: 'Turn remote control off.' },
    { name: 'CLAUDE_CODE_REMOTE', desc: 'Marks a remote environment.' },
    { name: 'CLAUDE_AX_SCREEN_READER', desc: 'Turn screen-reader mode on.' },
    { name: 'MAX_THINKING_TOKENS', desc: 'Cap thinking tokens. 0 disables thinking.' },
    { name: 'DISABLE_AUTOUPDATER', desc: 'Turn auto-updates off.' },
    { name: 'NO_COLOR / FORCE_COLOR', desc: 'Control colour in subprocesses.' }
  ];

  // settings that are picked up without a restart
  var LIVE_KEYS = ['permissions', 'hooks', 'apiKeyHelper'];
  var RESTART_KEYS = ['model', 'outputStyle'];

  global.CCH_SETTINGS = SETTINGS;
  global.CCH_SCOPES = SCOPES;
  global.CCH_PRECEDENCE = PRECEDENCE;
  global.CCH_ENV_VARS = ENV_VARS;
  global.CCH_LIVE = { live: LIVE_KEYS, restart: RESTART_KEYS };
})(window);
