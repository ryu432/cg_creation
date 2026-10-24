# ログインと同期の準備（Supabase・Google）

スマホのブラウザでもできます（パソコンのほうが画面が広くて楽です）。所要時間は 30 分ほど。

**守ること**
- ✅ チャットに貼ってよいもの：**Project ID**、**Publishable key**（`sb_publishable_...`。アプリに入れて公開する前提の鍵）
- ❌ チャットに貼らないもの：データベースのパスワード、Access Token、Google の **クライアント シークレット**、`sb_secret_...` / `service_role` の鍵
  → これらは GitHub の Secrets か、Supabase の画面に直接入れる

---

## 1. Supabase のプロジェクトを作る

1. https://supabase.com にログイン（GitHub アカウントでログインできます）
2. 「New project」
   - Name：`plano`
   - Database Password：「Generate a password」で作り、**パスワード管理アプリなどに控える**（4 で使う）
   - Region：**Northeast Asia (Tokyo)**
   - Plan：Free
3. 作成が終わるまで数分待つ
4. 左下の ⚙ **Project Settings → General** の **Project ID**（英字20文字ほど）を控える
5. **Project Settings → API Keys** の **Publishable key**（`sb_publishable_...`）を控える

## 2. Google のログイン用の設定（Google Cloud）

1. https://console.cloud.google.com を開く（いつもの Google アカウントで OK）
2. 上のプロジェクト選択 →「新しいプロジェクト」→ 名前 `plano` で作成し、そのプロジェクトを選ぶ
3. メニュー →「API とサービス」→「**OAuth 同意画面**」（または「Google Auth Platform」）
   - アプリ名：`Plano`、ユーザーサポートメール：自分のメール
   - 対象：**外部**
   - 連絡先メール：自分のメール → 作成
   - 「対象」（または「公開ステータス」）で **「アプリを公開」** を押して「本番環境」にする
     （メールアドレスと名前だけを使うログインなので、Google の審査は不要です。
       公開しない「テスト」のままだと、登録した人しかログインできません）
4. 「**クライアント**」（または「認証情報」→「認証情報を作成」→「OAuth クライアント ID」）
   - アプリケーションの種類：**ウェブ アプリケーション**
   - 名前：`Plano Supabase`
   - 承認済みのリダイレクト URI に追加：
     `https://<Project ID>.supabase.co/auth/v1/callback`
     （`<Project ID>` は 1-4 で控えたもの）
   - 作成
5. 表示された **クライアント ID** と **クライアント シークレット** を、次の 3 で Supabase に直接貼る（チャットには貼らない）

## 3. Supabase に Google ログインを設定する

1. Supabase の左メニュー **Authentication → Sign In / Providers**（または Providers）→ **Google**
   - Enable：オン
   - Client ID：2-5 のクライアント ID
   - Client Secret：2-5 のクライアント シークレット
   - Save
2. **Authentication → URL Configuration**
   - Site URL：`https://plano.expo.app`
   - Redirect URLs に2つ追加：
     - `https://plano.expo.app/**`
     - `plano://**`

## 4. GitHub に秘密の情報を登録する

データベースの変更（表や安全設定）を、GitHub から自動で本番に反映するために使います。

1. Supabase の右上のアイコン → **Account preferences → Access Tokens** →「Generate new token」
   - 名前：`github-actions` → 作成して表示されたトークンをコピー（一度しか表示されません）
2. GitHub のリポジトリ（ryu432/cg_creation）→ **Settings → Secrets and variables → Actions → New repository secret**
   - `SUPABASE_ACCESS_TOKEN`：4-1 のトークン
   - `SUPABASE_DB_PASSWORD`：1-2 のデータベースのパスワード

## 5. 終わったらチャットで教えてほしいもの

- Project ID
- Publishable key（`sb_publishable_...`）
- 4 の Secrets を登録したかどうか

これで私のほうで、データベースの反映とアプリの接続を進めます。
