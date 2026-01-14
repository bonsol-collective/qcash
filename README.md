# QCash Project Setup

This guide explains how to build the QCash extension and daemon, and set them up to communicate via Native Messaging.

## Prerequisites

*   **Rust**: Install via [rustup.rs](https://rustup.rs/).
*   **Node.js & npm**: Required for building the extension.
*   **Google Chrome**: The target browser for the extension.

## 1. Build Instructions

### Daemon & Methods
Compile the Rust daemon and RISC-0 methods from the project root:

```bash
cargo build --release
```

This creates the binary at `target/release/daemon`.

### Extension
Navigate to the extension directory and build the frontend:

```bash
cd extension
npm install
npm run build
```

The built extension files will be in `extension/dist`.

## 2. Extension Setup

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** in the top right corner.
3.  Click **Load unpacked**.
4.  Select the `extension/dist` folder (created in the previous step).
5.  **Important**: Note the **ID** assigned to the extension (e.g., `beehfekainnbonhcmplhjahhjplfkgjo`). You will need this for the next step.

## 3. Native Messaging Configuration

The daemon communicates with the extension using Chrome's Native Messaging API. You need to configure the host manifest file (`com.qcash.daemon.json`).

1.  **Open `com.qcash.daemon.json`** in a text editor.
2.  **Update `allowed_origins`**: Replace the existing ID with the ID you copied from `chrome://extensions`.
    ```json
    "allowed_origins": [
      "chrome-extension://YOUR_EXTENSION_ID_HERE/"
    ]
    ```
3.  **Update `path`**: Set the absolute path to your compiled daemon binary.
    *   Find your current directory with `pwd`.
    *   Update the `"path"` value to point to `<YOUR_PROJECT_ROOT>/target/release/daemon`.
    *   *Example*: `/home/username/projects/qcash/target/release/daemon`

## 4. Install Native Messaging Host

Once `com.qcash.daemon.json` is configured, copy it to Chrome's Native Messaging configuration directory.

**Run this command:**

```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
cp com.qcash.daemon.json ~/.config/google-chrome/NativeMessagingHosts/
```

## 5. Verification

1.  Restart the extension (click the reload icon on the extension card in `chrome://extensions`) or restart Chrome.
2.  Open the extension popup.
3.  The extension should now be able to launch and communicate with the daemon process.
