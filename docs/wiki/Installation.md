# Installation

| System | Download | Verified target |
| --- | --- | --- |
| Windows | [Windows installer, x64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-Setup-1.2.1-x64.exe) | Windows 11 x64 |
| Mac with Apple Silicon | [macOS disk image, arm64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-1.2.1-mac-arm64.dmg) | macOS 15, Apple Silicon |
| Mac with Intel processor | [macOS disk image, x64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-1.2.1-mac-x64.dmg) | macOS 15, Intel |
| Ubuntu Linux | [Debian package, x64](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/Proteonator-1.2.1-linux-x64.deb) | Ubuntu 22.04 and 24.04 x64 |

**Windows:** run the current-user installer, then open Proteonator from Start. Uninstall through Windows Apps. The installer is unsigned.

**macOS:** choose the disk image for your processor, open it, then drag Proteonator into Applications. In Finder, **About This Mac** identifies an Apple chip or Intel processor. The application has an ad-hoc signature and is **not signed with an Apple Developer ID or notarized**. macOS may block first opening. If you trust the source and have checked the checksum, follow [Apple’s instructions for opening an app from an unidentified developer](https://support.apple.com/en-us/102445). A signature-integrity check does not establish Gatekeeper approval. To update, quit the app and replace the copy in Applications. To uninstall, move that copy to Trash; projects and personal settings remain.

**Ubuntu:** download the `.deb`, open a terminal in its folder and run:

```sh
sudo apt install ./Proteonator-1.2.1-linux-x64.deb
```

Open Proteonator from the applications menu, or run `proteonator`. The installer registers `.proteonator` projects and resolves desktop-library dependencies. Use the same command with the new package to update. Remove the application with `sudo apt remove proteonator`; projects and personal settings remain. Administrator permission is needed to install or remove the system package, not to run the application. Keep the normal application sandbox enabled.

Each package includes the scientific runtime and offline guide. [Verify the SHA-256 checksums](https://github.com/fishhrbio/Proteonator/releases/download/v1.2.1/SHA256SUMS.txt) and save important projects before updating. Other systems and architectures are not verified. Native package tests do not establish Apple Gatekeeper approval or manual screen-reader compatibility.
