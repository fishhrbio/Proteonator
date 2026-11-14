!macro customInstallMode
  StrCpy $isForceMachineInstall "0"
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInstall
  ; Keep shell dispatch unambiguous in paths containing spaces or Unicode.
  WriteRegStr SHELL_CONTEXT "Software\Classes\Proteonator project\shell\open\command" "" '$\"$appExe$\" $\"%1$\"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Proteonator project\DefaultIcon" "" '$\"$INSTDIR\resources\icon.ico$\",0'
  !insertmacro UPDATEFILEASSOC
!macroend

!macro customUnInstall
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.proteonator" ""
  ${If} $0 == "Proteonator project"
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.proteonator" ""
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.proteonator\OpenWithProgids"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.proteonator"
  ${EndIf}
!macroend

!macro preInit
  !ifndef BUILD_UNINSTALLER
    ${If} ${isForAllUsers}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Proteonator 1.2 installs for the current user. All-users installation is unavailable." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  !endif
!macroend
