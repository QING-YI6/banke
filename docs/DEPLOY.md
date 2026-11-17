# 部署与打包

## 0. 先把项目推到 GitHub

在项目根目录：

```bash
git init
git add .
git commit -m "半刻 · 四瓣番茄钟"
git branch -M main
git remote add origin https://github.com/<你的用户名>/banke.git
git push -u origin main
```

仓库可以是私有。Actions 在私有仓库同样可用（每月有免费额度）。

推送后会自动触发：

- `build-android`：构建 debug APK；
- `deploy-web`：发布到 GitHub Pages（首次需要在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**）。

## 1. 手机 APK

1. 仓库页 → **Actions** → 左侧 **build-android** → 右侧 **Run workflow**。
2. 运行完成后点进去，页面底部 **Artifacts** → `banke-android-debug`。
3. 解压，得到 `app-debug.apk`。
4. 传到手机（微信文件传输 / 数据线 / 网盘均可），点击安装。
5. 第一次会提示「禁止安装未知应用」，在系统设置里允许当前文件管理器安装即可。

这个 APK：

- 包名 `com.banke.timer`，应用名「半刻」；
- 图标、启动图、深色状态栏都已替换；
- 最低 Android 5.1（API 22），目标 API 34；
- 使用 debug 签名，可直接安装，不适合上架。

### 常见失败

- **SDK license**：工作流里已经 `sdkmanager --licenses`，如果仍报错，检查 `android-actions/setup-android` 是否成功。
- **Gradle 与 Java 版本**：Capacitor 6 的 Gradle 8.2.1 需要 **Java 17**；工作流固定 17，不要改成 21。
- **`npm ci` 失败**：确认 `package-lock.json` 已提交，且与 `package.json` 同步（本地执行 `npm install --package-lock-only` 后提交）。
- **构建成功但安装失败**：手机系统版本低于 5.1，或与已安装的同包名应用签名冲突，先卸载旧版。

### release 签名（可选）

想生成可长期升级、可上架的 APK：

1. 本机生成 keystore（需要 JDK）：

```bash
keytool -genkeypair -v -keystore banke-release.jks -alias banke \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. 转成 base64：

```bash
# macOS / Linux
base64 -w 0 banke-release.jks > keystore.b64
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("banke-release.jks")) | Set-Content keystore.b64
```

3. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

- `ANDROID_KEYSTORE_BASE64`：keystore.b64 的内容
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

4. 在 `android/app/build.gradle` 的 `android { ... }` 里加：

```gradle
signingConfigs {
    release {
        storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "banke-release.jks")
        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
        keyAlias System.getenv("ANDROID_KEY_ALIAS")
        keyPassword System.getenv("ANDROID_KEY_PASSWORD")
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

5. 在工作流里加一步解码 keystore，并把 `assembleDebug` 换成 `assembleRelease`：

```yaml
- name: 写入 keystore
  run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/banke-release.jks
```

产物路径变成 `android/app/build/outputs/apk/release/app-release.apk`。

> 也可以本地用 Android Studio 打开 `android/` 目录直接 Build APK。需要 JDK 17 + Android SDK 34。

## 2. Windows 免安装 exe

**Actions** → **build-desktop** → **Run workflow**，完成后下载 `banke-windows`，解压得到 `Banke-1.0.0.exe`，双击运行。  
electron-builder 会打一个 portable exe，不需要安装。

本地构建：

```bash
npm install
npm i -D electron@33.2.0 electron-builder@25.1.8
npm run dist:win
```

产物在 `release/`。首次运行 Windows SmartScreen 可能提示「未知发布者」，选择「更多信息 → 仍要运行」。

## 3. GitHub Pages

`deploy-web` 工作流会把 `dist/` 发布到 Pages。首次：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**；
2. 重新运行 `deploy-web`；
3. 地址形如 `https://<用户名>.github.io/banke/`。

手机浏览器打开后可以「添加到主屏幕」，当作轻量网页版使用。  
注意：网页版的数据在浏览器里，和 APK 的数据不互通。

## 4. 本地单文件版

`npm run build` 会生成：

- `dist/index.html`
- 根目录 `半刻.html`

两者内容相同，都是把 JS / CSS / 图标全部内联的单文件，可以直接双击、发微信、放 U 盘。  
数据存在打开它的浏览器里；换电脑 / 换浏览器不会带走记录，记得导出 JSON。
