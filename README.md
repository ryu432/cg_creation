# Plano

「今日やること」をAIが理由つきで提案してくれるタスク管理アプリ。

- 企画書: [docs/planning.md](docs/planning.md)
- アプリ本体: [mobile/](mobile/)（Expo + TypeScript）

## スマホで動かす

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
