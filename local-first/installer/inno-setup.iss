; =========================================================================
; ChayaOne OS — Production Windows Main Cafe PC Installer Script
; Compiles ChayaOne-Setup-v1.0.exe for Windows 10/11 Main Cafe PC
; =========================================================================

#define AppName "ChayaOne OS"
#define AppVersion "1.0.0"
#define AppPublisher "Nuro7 / ChayaOne"
#define AppURL "https://chayaone.com"
#define AppExeName "START_CHAYAONE.bat"

[Setup]
AppId={{D819C0E2-51E9-4B52-9A0E-85C92B45F311}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/support
AppUpdatesURL={#AppURL}/updates
DefaultDirName={autopf}\ChayaOne OS
DefaultGroupName=ChayaOne OS
AllowNoIcons=yes
OutputDir=.\dist
OutputBaseFilename=ChayaOne-Setup-v1.0
SetupIconFile=..\platform\apps\web\public\favicon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostartservice"; Description: "Configure ChayaOne OS background services for automatic startup"; GroupDescription: "System Services:"

[Dirs]
; Read-only binaries in Program Files
Name: "{app}\Desktop"
Name: "{app}\Server"
Name: "{app}\PrintManager"
Name: "{app}\Updater"
Name: "{app}\Runtime"

; Persistent writable customer data in ProgramData
Name: "{commonappdata}\ChayaOne\data"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\backups"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\logs"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\config"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\updates\staging"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\updates\downloaded"; Permissions: users-full
Name: "{commonappdata}\ChayaOne\updates\backup"; Permissions: users-full

[Files]
; Copy platform build, web, desktop, and runtime files
Source: "..\platform\*"; DestDir: "{app}\platform"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\.cache,*.log,.localdb\*"

; Idempotent Database Directory (never overwrite existing customer database on upgrade)
Source: "..\platform\packages\db\.localdb\*"; DestDir: "{commonappdata}\ChayaOne\data"; Flags: onlyifdestfilemissing recursesubdirs createallsubdirs uninsneveruninstall

; Copy WinSW Service XML configuration files
Source: "ChayaOne-PostgreSQL.xml"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "ChayaOne-WebServer.xml"; DestDir: "{app}\installer"; Flags: ignoreversion

[Icons]
Name: "{group}\ChayaOne OS POS"; Filename: "http://localhost:3000/pos"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"
Name: "{group}\ChayaOne System Settings"; Filename: "http://localhost:3000/dashboard"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"
Name: "{autodesktop}\ChayaOne POS"; Filename: "http://localhost:3000/pos"; IconFilename: "{app}\platform\apps\web\public\favicon.ico"; Tasks: desktopicon

[Run]
; Open Windows Defender Firewall rule for HTTP Server (Port 3000 - Private LAN only)
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Web Server"" dir=in action=allow protocol=TCP localport=3000 profile=private"; Flags: runhidden

; Open Windows Defender Firewall rule for WebSocket Server (Port 3001 - Private LAN only)
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""ChayaOne OS Realtime WS"" dir=in action=allow protocol=TCP localport=3001 profile=private"; Flags: runhidden

; Initialize Database & Run Prisma migrations on install
Filename: "node"; Parameters: "scripts/ensure-db.mjs"; WorkingDir: "{app}\platform\packages\db"; Flags: runhidden

; Launch local server and POS interface after installation completes
Filename: "node"; Parameters: "scripts/launch-local-server.mjs"; WorkingDir: "{app}\platform"; Flags: postinstall nowait skipifsilent description: "Launch ChayaOne OS POS Till immediately"

[UninstallRun]
; Cleanly remove Windows Defender Firewall rules upon uninstallation
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""ChayaOne OS Web Server"""; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""ChayaOne OS Realtime WS"""; Flags: runhidden

[Code]
var
  CafeConfigPage: TInputQueryWizardPage;
  BusinessTypePage: TInputOptionWizardPage;
  ModuleSelectPage: TInputOptionWizardPage;
  PortConfigPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  { Page 1: Cafe Profile Setup }
  CafeConfigPage := CreateInputQueryPage(wpSelectDir,
    'Cafe Setup', 'Configure your local restaurant profile',
    'Please enter the details for this Main PC installation. Safe defaults are provided.');
  CafeConfigPage.Add('Cafe / Restaurant Name:', False);
  CafeConfigPage.Add('Cafe ID / Subdomain:', False);
  CafeConfigPage.Values[0] := 'Kahwa House';
  CafeConfigPage.Values[1] := 'kahwa';

  { Page 2: Choose Your Business Type }
  BusinessTypePage := CreateInputOptionPage(CafeConfigPage.ID,
    'Choose Your Business', 'What type of business is this?',
    'Select your business profile to configure the initial recommended module suite.',
    True, False);
  BusinessTypePage.Add('Cafe');
  BusinessTypePage.Add('Juice');
  BusinessTypePage.Add('Bakery');
  BusinessTypePage.Add('Restaurant');
  BusinessTypePage.Add('Hotel');
  BusinessTypePage.Add('Tea Shop');
  BusinessTypePage.Add('Fast Food');
  BusinessTypePage.Add('Retail');
  BusinessTypePage.Add('Other / Multi-category');
  BusinessTypePage.SelectedValueIndex := 0; { Default: Cafe }

  { Page 3: Module Selection }
  ModuleSelectPage := CreateInputOptionPage(BusinessTypePage.ID,
    'Select Modules', 'Enable or disable feature modules',
    'Choose which modules to activate for this venue. Core POS is required. Modules can be enabled or disabled later in Settings without reinstalling.',
    False, False);
  ModuleSelectPage.Add('Core POS & Billing (Required)'); { Index 0: core }
  ModuleSelectPage.Add('Cafe');                          { Index 1: cafe }
  ModuleSelectPage.Add('Restaurant');                    { Index 2: restaurant }
  ModuleSelectPage.Add('Hotel Management');              { Index 3: hotel }
  ModuleSelectPage.Add('Juice & Beverages');             { Index 4: juice }
  ModuleSelectPage.Add('Meals / Rice');                  { Index 5: meals }
  ModuleSelectPage.Add('Bakery & Pastry');               { Index 6: bakery }
  ModuleSelectPage.Add('Retail & Barcode POS');          { Index 7: retail }
  ModuleSelectPage.Add('Inventory');                     { Index 8: inventory }
  ModuleSelectPage.Add('Customer QR');                   { Index 9: customer_qr }
  ModuleSelectPage.Add('Waiter App');                    { Index 10: waiter }
  ModuleSelectPage.Add('KDS Kitchen Display');           { Index 11: kds }
  ModuleSelectPage.Add('Loyalty & CRM');                 { Index 12: crm + loyalty }
  ModuleSelectPage.Add('Advanced Reports');              { Index 13: advanced_reports }

  { Initial preset defaults for Cafe }
  ModuleSelectPage.Values[0] := True;
  ModuleSelectPage.Values[1] := True;

  { Page 4: Local Server Ports }
  PortConfigPage := CreateInputQueryPage(ModuleSelectPage.ID,
    'Local Server Configuration', 'Network Port Settings',
    'ChayaOne runs locally on the Main PC. Standard defaults ensure local LAN client compatibility.');
  PortConfigPage.Add('Web / API Port:', False);
  PortConfigPage.Add('WebSocket Port:', False);
  PortConfigPage.Add('PostgreSQL Port:', False);
  PortConfigPage.Values[0] := '3000';
  PortConfigPage.Values[1] := '3001';
  PortConfigPage.Values[2] := '5433';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  i: Integer;
begin
  Result := True;

  { If leaving BusinessTypePage, automatically configure ModuleSelectPage based on the chosen preset }
  if CurPageID = BusinessTypePage.ID then
  begin
    for i := 1 to 13 do
      ModuleSelectPage.Values[i] := False;

    { Core POS is always mandatory }
    ModuleSelectPage.Values[0] := True;

    case BusinessTypePage.SelectedValueIndex of
      0: { Cafe }
      begin
        ModuleSelectPage.Values[1] := True; { Cafe }
      end;

      1: { Juice }
      begin
        ModuleSelectPage.Values[4] := True; { Juice }
      end;

      2: { Bakery }
      begin
        ModuleSelectPage.Values[6] := True; { Bakery }
        ModuleSelectPage.Values[8] := True; { Inventory }
      end;

      3: { Restaurant }
      begin
        ModuleSelectPage.Values[2] := True; { Restaurant }
        ModuleSelectPage.Values[10] := True; { Waiter }
        ModuleSelectPage.Values[11] := True; { KDS }
      end;

      4: { Hotel }
      begin
        ModuleSelectPage.Values[2] := True; { Restaurant }
        ModuleSelectPage.Values[3] := True; { Hotel }
        ModuleSelectPage.Values[10] := True; { Waiter }
      end;

      5: { Tea Shop }
      begin
        ModuleSelectPage.Values[1] := True; { Cafe / Tea }
      end;

      6: { Fast Food }
      begin
        ModuleSelectPage.Values[2] := True; { Restaurant }
        ModuleSelectPage.Values[11] := True; { KDS }
      end;

      7: { Retail }
      begin
        ModuleSelectPage.Values[7] := True; { Retail }
        ModuleSelectPage.Values[8] := True; { Inventory }
      end;

      8: { Other / Multi-category }
      begin
        ModuleSelectPage.Values[1] := True; { Cafe }
        ModuleSelectPage.Values[2] := True; { Restaurant }
        ModuleSelectPage.Values[4] := True; { Juice }
        ModuleSelectPage.Values[8] := True; { Inventory }
        ModuleSelectPage.Values[9] := True; { Customer QR }
        ModuleSelectPage.Values[10] := True; { Waiter }
        ModuleSelectPage.Values[11] := True; { KDS }
      end;
    end;
  end;

  { If leaving ModuleSelectPage, validate that Core is always checked and handle dependencies }
  if CurPageID = ModuleSelectPage.ID then
  begin
    ModuleSelectPage.Values[0] := True; { Enforce Core required }

    { If Hotel is selected, automatically include Restaurant }
    if ModuleSelectPage.Values[3] then
      ModuleSelectPage.Values[2] := True;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvContent: string;
  EnvFilePath: string;
  ConfigJsonPath: string;
  ConfigJsonContent: string;
  InstallJsonPath: string;
  InstallJsonContent: string;
  InstallId: string;
  RandomHex: string;
  BusinessTypeStr: string;
  EnabledModulesStr: string;
  JsonModulesArray: string;
begin
  if CurStep = ssPostInstall then
  begin
    { Map selected business type to identifier }
    case BusinessTypePage.SelectedValueIndex of
      0: BusinessTypeStr := 'cafe';
      1: BusinessTypeStr := 'juice';
      2: BusinessTypeStr := 'bakery';
      3: BusinessTypeStr := 'restaurant';
      4: BusinessTypeStr := 'hotel';
      5: BusinessTypeStr := 'tea_shop';
      6: BusinessTypeStr := 'fast_food';
      7: BusinessTypeStr := 'retail';
      else BusinessTypeStr := 'other';
    end;

    { Build list of enabled module IDs }
    EnabledModulesStr := 'core';
    JsonModulesArray := '"core"';

    if ModuleSelectPage.Values[1] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',cafe';
      JsonModulesArray := JsonModulesArray + ',"cafe"';
    end;
    if ModuleSelectPage.Values[2] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',restaurant';
      JsonModulesArray := JsonModulesArray + ',"restaurant"';
    end;
    if ModuleSelectPage.Values[3] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',hotel';
      JsonModulesArray := JsonModulesArray + ',"hotel"';
    end;
    if ModuleSelectPage.Values[4] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',juice';
      JsonModulesArray := JsonModulesArray + ',"juice"';
    end;
    if ModuleSelectPage.Values[5] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',meals';
      JsonModulesArray := JsonModulesArray + ',"meals"';
    end;
    if ModuleSelectPage.Values[6] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',bakery';
      JsonModulesArray := JsonModulesArray + ',"bakery"';
    end;
    if ModuleSelectPage.Values[7] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',retail';
      JsonModulesArray := JsonModulesArray + ',"retail"';
    end;
    if ModuleSelectPage.Values[8] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',inventory';
      JsonModulesArray := JsonModulesArray + ',"inventory"';
    end;
    if ModuleSelectPage.Values[9] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',customer_qr';
      JsonModulesArray := JsonModulesArray + ',"customer_qr"';
    end;
    if ModuleSelectPage.Values[10] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',waiter';
      JsonModulesArray := JsonModulesArray + ',"waiter"';
    end;
    if ModuleSelectPage.Values[11] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',kds';
      JsonModulesArray := JsonModulesArray + ',"kds"';
    end;
    if ModuleSelectPage.Values[12] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',crm,loyalty';
      JsonModulesArray := JsonModulesArray + ',"crm","loyalty"';
    end;
    if ModuleSelectPage.Values[13] then
    begin
      EnabledModulesStr := EnabledModulesStr + ',advanced_reports';
      JsonModulesArray := JsonModulesArray + ',"advanced_reports"';
    end;

    { 1. Generate local production .env file with configured values }
    EnvFilePath := ExpandConstant('{app}\platform\.env');
    EnvContent :=
      'DATABASE_URL="postgresql://cafeos:cafeos@localhost:' + PortConfigPage.Values[2] + '/cafeos"' + #13#10 +
      'DIRECT_URL="postgresql://cafeos:cafeos@localhost:' + PortConfigPage.Values[2] + '/cafeos"' + #13#10 +
      'CHAYAONE_RUNTIME_MODE="local"' + #13#10 +
      'CHAYAONE_CLOUD_ENABLED="false"' + #13#10 +
      'DEV_TENANT_SUBDOMAIN="' + CafeConfigPage.Values[1] + '"' + #13#10 +
      'CHAYAONE_BUSINESS_TYPE="' + BusinessTypeStr + '"' + #13#10 +
      'CHAYAONE_ENABLED_MODULES="' + EnabledModulesStr + '"' + #13#10 +
      'PORT="' + PortConfigPage.Values[0] + '"' + #13#10 +
      'WS_PORT="' + PortConfigPage.Values[1] + '"' + #13#10 +
      'JWT_SECRET="chayaone-local-jwt-secret-key-32-chars-long"' + #13#10 +
      'PLATFORM_JWT_SECRET="chayaone-local-platform-jwt-secret-key-admin"' + #13#10 +
      'OTP_DEV_ECHO="1"' + #13#10;
    
    SaveStringToFile(EnvFilePath, EnvContent, False);

    { 2. Write modules-config.json to ProgramData only if file does not already exist (preserves client settings across updates) }
    ConfigJsonPath := ExpandConstant('{commonappdata}\ChayaOne\config\modules-config.json');
    if not FileExists(ConfigJsonPath) then
    begin
      ConfigJsonContent :=
        '{' + #13#10 +
        '  "businessType": "' + BusinessTypeStr + '",' + #13#10 +
        '  "enabledModules": [' + JsonModulesArray + '],' + #13#10 +
        '  "installedModules": ["core","cafe","restaurant","hotel","juice","meals","bakery","retail","inventory","customer_qr","waiter","kds","crm","loyalty","advanced_reports"],' + #13#10 +
        '  "updatedAt": "' + GetDateTimeString('yyyy-mm-dd"T"hh:nn:ss"Z"', '-', ':') + '",' + #13#10 +
        '  "version": "1.2.0",' + #13#10 +
        '  "moduleSettings": {}' + #13#10 +
        '}' + #13#10;
      SaveStringToFile(ConfigJsonPath, ConfigJsonContent, False);
    end;

    { 3. Generate persistent installation.json with unique Installation ID if not already present }
    InstallJsonPath := ExpandConstant('{commonappdata}\ChayaOne\config\installation.json');
    if not FileExists(InstallJsonPath) then
    begin
      RandomHex := Format('%.4x%.4x', [Random(65536), Random(65536)]);
      InstallId := 'CHAYAONE-INSTALL-' + UpperCase(RandomHex);
      InstallJsonContent :=
        '{' + #13#10 +
        '  "installationId": "' + InstallId + '",' + #13#10 +
        '  "installedAt": "' + GetDateTimeString('yyyy-mm-dd"T"hh:nn:ss"Z"', '-', ':') + '",' + #13#10 +
        '  "appVersion": "' + ExpandConstant('{#AppVersion}') + '",' + #13#10 +
        '  "platform": "win32"' + #13#10 +
        '}' + #13#10;
      SaveStringToFile(InstallJsonPath, InstallJsonContent, False);
    end;
  end;
end;

