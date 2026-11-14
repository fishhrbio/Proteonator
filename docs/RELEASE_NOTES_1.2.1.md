# Proteonator 1.2.1

Proteonator is now available as a Windows installer, separate Apple Silicon and Intel Mac disk images, and an Ubuntu x64 Debian package. Each includes the local scientific runtime, examples and offline help. No separate Python installation is needed.

| System | Download | Verified target |
| --- | --- | --- |
| Windows | [Windows installer, x64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-Setup-1.2.1-x64.exe) | Windows 11 x64 |
| Mac with Apple Silicon | [macOS disk image, arm64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-1.2.1-mac-arm64.dmg) | macOS 15, Apple Silicon |
| Mac with Intel processor | [macOS disk image, x64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-1.2.1-mac-x64.dmg) | macOS 15, Intel |
| Ubuntu Linux | [Debian package, x64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-1.2.1-linux-x64.deb) | Ubuntu 22.04 and 24.04 x64 |

**macOS:** choose the disk image for your processor, open it, then drag Proteonator into Applications. In Finder, **About This Mac** identifies an Apple chip or Intel processor. The application has an ad-hoc signature and is **not signed with an Apple Developer ID or notarized**. macOS may block first opening. If you trust the source and have checked the checksum, follow [Apple’s instructions for opening an app from an unidentified developer](https://support.apple.com/en-us/102445). A signature-integrity check does not establish Gatekeeper approval. To update, quit the app and replace the copy in Applications. To uninstall, move that copy to Trash; projects and personal settings remain.

**Ubuntu:** download the `.deb`, open a terminal in its folder and run:

```sh
sudo apt install ./Proteonator-1.2.1-linux-x64.deb
```

Open Proteonator from the applications menu, or run `proteonator`. The installer registers `.proteonator` projects and resolves desktop-library dependencies. Use the same command with the new package to update. Remove the application with `sudo apt remove proteonator`; projects and personal settings remain. Administrator permission is needed to install or remove the system package, not to run the application. Keep the normal application sandbox enabled.

Windows 11 x64 uses the current-user installer and remains unsigned. Compare every download with the attached SHA-256 checksums. Mac packages have ad-hoc signatures, without Apple Developer ID signing or notarization; Gatekeeper approval is not claimed. Other Linux distributions, Linux/Windows ARM64 and unlisted macOS releases are not verified.

The update adds native document opening, platform-appropriate menu shortcuts and icons, portable scientific-library loading and native license inventories. The molecular, construct, coding-sequence and RNA tools retain the 1.2 scientific scope. Local relaxation is not global folding, affinity or expression prediction; back-translation is not transcript recovery. Native RNA-family engines/databases are not bundled.

Read the [user guide](USER_GUIDE.md), [scientific methods](SCIENCE.md) and [roadmap](../ROADMAP.md). Projects and personal settings are retained when the application is removed.
