# Plano

「今日やること」を、期限と使える時間から理由つきで提案してくれるタスク管理アプリ。

- 仕様書（今できること）: [docs/spec.md](docs/spec.md)
- 企画書・ロードマップ: [docs/planning.md](docs/planning.md)
- アプリ本体: [mobile/](mobile/)（Expo + TypeScript）

## スマホで使う（Android）

Plano 専用アプリ（APK）を EAS でクラウドビルドして、スマホにインストールする。パソコンは不要。

1. GitHub Actions の **EAS Build** を実行する（`mobile/package.json`・`app.json`・`eas.json` を変更してプッシュしたときも自動で動く）
2. ログの最後に出る APK のリンクをスマホで開き、インストールする（初回は「提供元不明のアプリ」を許可する）
3. 以後の修正は `mobile/` をプッシュすると **EAS Update** で配信され、アプリを開き直すと反映される
   - 部品の構成（ネイティブ部分）が変わったときは、作り直したアプリにだけ届く（`runtimeVersion: fingerprint`）。そのときは 1〜2 をやり直す

データは端末の中に保存される。別のアプリへ移すときは、設定 → データ →「データを書き出す」→ 移行先で「データを読み込む」。

## パソコンで開発するとき（Expo Go）

### 準備（最初の1回だけ）

1. パソコンに [Node.js](https://nodejs.org/)（LTS版）をインストールする
2. スマホに **Expo Go** アプリをインストールする（App Store / Google Play）
3. このリポジトリを clone して、依存パッケージを入れる

```bash
git clone https://github.com/ryu432/cg_creation.git
cd cg_creation/mobile
npm install
```

### 起動

```bash
cd mobile
npx expo start
```

ターミナルに QR コードが表示されるので、

- **iPhone**: カメラアプリで QR コードを読む
- **Android**: Expo Go アプリの「Scan QR code」で読む

スマホに「Hello Plano」と表示されれば成功です。

> パソコンとスマホは同じ Wi-Fi につないでください。
> つながらない場合は `npx expo start --tunnel` を試してください。

### よく使うコマンド

```bash
npx expo start      # 開発サーバーを起動
npx tsc --noEmit    # 型チェック
npx expo install <パッケージ名>  # パッケージの追加（npm install ではなくこちらを使う）
```
