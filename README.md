# ことばポケット

ウェブページで気になった単語を保存し、あとで見返すChrome拡張です。

## できること

- 選択した単語やフレーズを、保存ボタン・右クリック・ショートカットで保存。
- 単語、ページ名、ページのURL、保存日時を端末内に記録。
- 新しい順に一覧表示し、元ページを開いたり、単語を削除したりできます。
- 保存済みの単語をCSVでまとめて書き出せます。
- アカウント登録や外部サーバーは不要です。

## 手元で使う

Node.js 22以降と、ZIP作成時は `zip` コマンドを使います。外部パッケージのインストールは不要です。

```sh
npm run check
npm run package:extension
```

1. Chromeで `chrome://extensions` を開きます。
2. 「デベロッパーモード」を有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」から `extension/` を選びます。
4. 通常のウェブページで単語を選択します。
5. 拡張アイコンを開いて「選択したことばを保存」、または右クリックから「ことばポケットに保存」を使います。

標準ショートカットはWindows/Linuxでは `Ctrl+Shift+Y`、Macでは `Command+Shift+Y` です。別の拡張などと重なると未設定になる場合があります。ポップアップに表示されるキーを確認し、クリックして `chrome://extensions/shortcuts` から変更できます。

## 表示言語と配色

日本語と英語に対応しています。Chromeの言語を初期値にし、画面右上から切り替えられます。選択した言語は端末に保存されます。

- `_locales/ja/messages.json` と `_locales/en/messages.json`: 表示文言、保存通知、エラー、CSVの見出し。
- `theme.json`: ライト・ダーク表示、通知、ロゴ・アイコンの色。
- `scripts/generate-assets.mjs`: 色設定から `tokens.css`、ロゴSVG、各サイズのPNGを生成。

文言や色を変更した後は `npm run package:extension` を実行し、Chromeの拡張管理画面で再読み込みします。生成済みのCSSやアイコンを直接編集する必要はありません。

## 紹介サイトを確認する

```sh
npm run build
python3 -m http.server 8000 --directory site
```

`http://localhost:8000` で日本語版、`http://localhost:8000/en.html` で英語版を確認できます。ページ右上でも言語を切り替えられます。

サイトの文言は `site/locales/ja.json` と `site/locales/en.json`、レイアウトは `site/page.html`、スタイルは `site/styles.css` にあります。`npm run build` で日英のHTMLとサイト用アイコンを生成します。色は拡張と共通の `theme.json` を使い、端末のライト・ダーク設定に合わせて表示します。サイトは静的HTMLなので、GitHub Pagesでは `site/` を公開できます。自動公開はまだ設定していません。

## データとCSV

単語は `chrome.storage.local` に保存します。Chromeを閉じても残りますが、拡張機能を削除すると消えます。「CSVを書き出す」からファイルを保存できます。CSVには日本語対応のUTF-8 BOMを付け、引用符・改行・カンマを処理します。表計算ソフトで数式として扱われる文字列には先頭にアポストロフィを付けます。拡張内の単語自体は変更しません。

同じ単語は、保存元のページが違っても二重に保存しません。前後の空白を除いた文字列が同じ場合に重複と判定し、大文字・小文字などは区別します。すでにある記録は変更しません。保存可能な容量を超えるとエラーを表示し、保存済みのデータは残します。

## 公開用ZIP

```sh
npm run zip:extension
```

`release/kotoba-pocket-extension-v0.1.0.zip` を作成します。ZIP直下に `manifest.json` があり、実行用のファイルとプライバシーの説明だけが入ります。テスト・開発用スクリプトは含めません。構成はLazy Diffの `extension/` と `release/` に合わせています。

公開作業はユーザーが行います。掲載用文面と権限の説明は `STORE_LISTING.md`、プライバシーの文面は `PRIVACY.md` と `site/privacy/index.html` にあります。公開するプライバシーポリシーのURL、連絡先、実機で撮ったスクリーンショットは提出時に設定します。ストアには未提出です。

## 制限

- Chromeの設定画面・ウェブストア・その他Chromeが拡張の実行を許可しないページでは、選択内容を取得できません。
- ショートカットと保存ボタンは、ページ本体と同じ送信元のフレームにある選択範囲を対象とします。別の送信元の埋め込み部分では、右クリックの保存を試してください。
- パスワード入力欄は読み取りません。
- 単語または短いフレーズを想定し、1回の保存は5,000文字以内です。
- Google Drive・Google Sheets連携は `TODO.md` に記録した今後の機能です。現時点でGoogleへの接続は行いません。

## 構成

```text
manifest.json        拡張機能の設定
popup.html / .css    ポップアップ画面
_locales/           日本語・英語の文言
theme.json          共通の色設定
src/                保存・単語取得・画面の処理
assets/             アイコンの原本とPNG
scripts/            検証・読み込み用フォルダー・ZIP作成
tests/              自動テスト
site/               公開用の紹介ページとプライバシー説明
extension/          Chromeに読み込む生成物
release/            ストアに提出するZIP
```

GitHub Actionsはmainへのpush・タグ・PR・手動実行時に検証し、ZIPを成果物として保存します。ストアへの自動公開は行いません。
