#define MyAppName "DupeSweep"
#define MyAppVersion "0.2.0"
#define MyAppPublisher "DupeSweep contributors"
#define MyAppURL "https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner"
#define MyAppExeName "DupeSweep.exe"

[Setup]
AppId={{90C16F8A-44AF-4B0C-A389-F26143240E0A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=..\release
OutputBaseFilename=DupeSweep-Setup
SetupIconFile=..\assets\dupesweep.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}

[Languages]
Name: "chinesetraditional"; MessagesFile: "compiler:Languages\ChineseTraditional.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "建立桌面捷徑"; GroupDescription: "其他工作："; Flags: unchecked

[Files]
Source: "..\dist\DupeSweep\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "啟動 {#MyAppName}"; Flags: nowait postinstall skipifsilent
