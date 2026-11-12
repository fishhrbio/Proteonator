!macro customInstallMode
  StrCpy $isForceMachineInstall "0"
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro preInit
  !ifndef BUILD_UNINSTALLER
    ${If} ${isForAllUsers}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Proteonator 1.1 installs for the current user. All-users installation is unavailable." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  !endif
!macroend
