<h1 align="center">Genre Police Visualizer</h1>

<p align="center">再生中の音楽ジャンルに合わせて視覚表現が変化する Windows 用デスクトップ音楽ビジュアライザー</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · 日本語
</p>

Genre Police Visualizer は、Windows の再生中メディア情報とシステム再生音声を読み取り、音楽ジャンルを推定します。その結果に応じて、ビジュアライザーの構造、背景、文字、動き方を切り替えます。単にジャンルごとに色を変えるのではなく、それぞれの音楽に合った視覚表現を目指しています。

現在のリリースは `0.3.0` ベータ版です。選択可能な 140 種類のジャンルビジュアルで、20 以上の主要なジャンル系統をカバーしています。電子音楽を主なデザイン対象としながら、Pop、Rock、Hip-Hop、R&B、Jazz、Classical の各系統も追加・調整しています。

## ダウンロード

**[Releases から Windows ポータブル版をダウンロード](../../releases)**

- 対応環境：Windows 10 または Windows 11、64 ビット（x64）。
- `Genre-Police-Visualizer-0.3.0-portable.exe` をダウンロードして、そのまま実行できます。インストールは不要です。
- Node.js、Python、PyTorch、追加の AI 実行環境は必要ありません。
- 必要に応じて `SHA256SUMS.txt` もダウンロードし、実行ファイルを検証してください。

`0.3.0` は Authenticode によるコード署名を行っていません。そのため Windows SmartScreen に「不明な発行元」と表示される場合があります。実行ファイルは、このプロジェクトの GitHub Releases からのみダウンロードしてください。

## 画面プレビュー

### カプセル

<p align="center">
  <a href="docs/screenshots/electro-house-capsule.png"><img src="docs/screenshots/electro-house-capsule.png" alt="Electro House・カプセルレイアウト" width="92%" /></a>
</p>

<p align="center">
  <a href="docs/screenshots/techno-capsule.png"><img src="docs/screenshots/techno-capsule.png" alt="Techno・カプセルレイアウト" width="92%" /></a>
</p>

### ポスター

<p align="center">
  <a href="docs/screenshots/dubstep-poster.png"><img src="docs/screenshots/dubstep-poster.png" alt="Dubstep・ポスターレイアウト" width="46%" /></a>
  <a href="docs/screenshots/neurofunk-poster.png"><img src="docs/screenshots/neurofunk-poster.png" alt="Neurofunk・ポスターレイアウト" width="46%" /></a>
</p>

### フルスクリーン

<p align="center">
  <a href="docs/screenshots/synthwave-fullscreen.png"><img src="docs/screenshots/synthwave-fullscreen.png" alt="Synthwave・フルスクリーン上下レイアウト" width="46%" /></a>
  <a href="docs/screenshots/trance-fullscreen-split.png"><img src="docs/screenshots/trance-fullscreen-split.png" alt="Trance・フルスクリーン左右レイアウト" width="46%" /></a>
</p>

## 主な機能

- **ジャンル別の視覚表現**：色だけでなく、構造、背景、フォント、パーティクル、モーションもジャンルに応じて切り替えます。
- **ローカルAIジャンル補助認識**：内蔵の Discogs-EffNet モデルが、不明、大まか、またはアーティスト情報だけの結果を補完します。再生中に明確なジャンル変化が続いた場合だけ検出するオプションもあります。アーティストのジャンル情報参照は個別に無効化でき、音声はアップロードされません。
- **3 種類の表示モード**：カプセル型、ポスター型、フルスクリーンに対応します。フルスクリーンでは上下／左右構成を切り替え、文字、再生、画像保存、録画、設定をその場で操作できます。
- **リアルタイム音声反応**：スペクトラム、リズム、BPM、エネルギー、インパクト表現をシステム再生音声で駆動し、内蔵のローカル BeatNet ONNX モデルが拍の解析を補助します。
- **画面録画**：現在のビジュアライザーとシステム再生音声を MP4 としてリアルタイム保存します。MP4 エンコードを利用できない環境では WebM を自動的に使用します。
- **画面保存とクイック修正**：現在のビジュアライザーを背景透過 PNG として保存できます。ジャンル見出しから候補の確認、この曲だけのビジュアル固定、修正の記憶ができます。
- **再生中情報と操作**：曲名、アーティスト、アルバム、アートワーク、再生状態、進行状況を表示し、前の曲、再生／一時停止、次の曲を操作できます。
- **カスタムジャンル**：タグの別名またはアーティストによるローカル判定ルールを追加し、カスタム名に既存のビジュアルを継承できます。必要に応じて 3 つのテーマカラーも上書きできます。
- **同期歌詞**：同期歌詞、単語または文字単位のハイライト、取得できる場合は歌詞翻訳に対応。表示タイミングを調整したり、歌詞検索を完全に無効にしたりできます。
- **デスクトップ向け設定**：50%–150% の等倍スケーリング、穏やか／標準／強い画面応答、ウィンドウ位置の保存、メディアソース選択、常に手前、デスクトップレイヤー、マウス透過、無音時の動作設定に対応します。
- **更新と診断**：GitHub Releases の更新を自動または手動で確認でき、診断表示では一時的にリアルタイム FPS を確認できます。
- **多言語 UI**：簡体中文、English、日本語、한국어を切り替えられます。

## 対応範囲

Windows のシステムメディアセッションを公開するプレイヤーであれば利用できます。Apple Music、Spotify、QQ Music、NetEase Cloud Music、Kugou、YouTube Music、Amazon Music などに対応しますが、アプリやバージョンによって取得できるアートワーク、再生位置、ジャンル情報が異なる場合があります。

NetEase Cloud Music は既定でシステムメディアセッションを公開しない場合があります。NetEase の起動中にメディアセッションが見つからないときは、「設定 → システム」の「开启SMTC」（SMTC を有効にする）チェックボックスが案内されます。

現在の主なジャンル対応範囲：

- Hardcore、Hardstyle、House、Future Bass、Dubstep、EDM Trap
- Drum & Bass、UK Garage、Breakbeat、Techno、Trance、Synthwave
- Pop、J-Pop、K-Pop、Rock、Metal、Hip-Hop、R&B
- Jazz、Classical、Soundtrack、Country、Folk、Latin、Reggae などの一般的な大分類

ジャンル判定には、プレイヤーのメタデータ、公開音楽カタログ、ローカルルール、ユーザーが保存した修正結果を組み合わせます。複合ジャンル、Remix、コンピレーション、複数ジャンルで活動するアーティストは誤判定されることがあります。表示結果は絶対的な分類ではありません。

## 基本的な使い方

1. ポータブル版 EXE を実行します。
2. Windows のシステムメディアセッションに対応したプレイヤーで音楽を再生します。
3. ビジュアライザーは既定でメインディスプレイの右下付近に表示され、システムトレイに Genre Police のアイコンが追加されます。
4. 上部ボタンでカプセル、ポスター、フルスクリーンを切り替え、設定画面またはトレイメニューから背景、サイズ、歌詞、モーションを調整します。
5. 「アプリ」設定またはトレイメニューから録画を開始し、トレイメニューまたは `Ctrl+Shift+R` で停止して動画を完成させます。

音声出力デバイスを変更したあとに反応しなくなった場合は、トレイメニューから「システム音声を再キャプチャ」を選択してください。

## プライバシーと通信

- システム再生音声はローカルで解析されます。ユーザーが録画を開始して保存先を選んだ場合に限り動画へ書き込まれ、音声や動画が自動的にアップロードされることはありません。
- テレメトリ、広告 SDK、アカウント機能、自動クラッシュ送信は含まれていません。
- オンラインジャンル検索と同期歌詞は個別に無効化できます。有効な場合も、曲名、アーティスト、アルバム、再生時間など照合に必要な情報だけを記載済みのサービスへ送信し、音声は送信しません。
- 適応型背景はウィンドウ周辺の低解像度な色統計をローカルで取得しますが、スクリーンショットは保存しません。

詳しいデータ処理については [プライバシー説明（中国語／英語）](docs/PRIVACY.md) を参照してください。

## 現在の制限

- 現在は Windows 10/11 x64 のみ対応しています。
- プレイヤーが Windows のメディアセッションを公開していない場合、完全な再生中情報を取得できません。
- 単語／文字単位のハイライトは、多くの場合行単位のタイムスタンプから推定しており、配信元が提供する実際の音節タイムラインとは異なります。
- 透明な最前面ウィンドウは、一部の HDR、マルチ GPU、リモートデスクトップ、画面キャプチャ環境で表示が異なる場合があります。
- まだテスト版のため、ジャンル判定と視覚表現は今後も調整されます。

詳細は [既知の問題（中国語／英語）](docs/KNOWN_ISSUES.md) を参照してください。

## ドキュメント

- [アーキテクチャ（英語）](docs/ARCHITECTURE.md)
- [プライバシー](docs/PRIVACY.md)
- [既知の問題](docs/KNOWN_ISSUES.md)
- [更新履歴](CHANGELOG.md)
- [サードパーティーライセンス](THIRD_PARTY_NOTICES.md)
- [セキュリティポリシー](SECURITY.md)

## ソースから実行する

開発環境には Windows 10/11 x64 と Node.js 22.12 以降が必要です。

```powershell
npm ci
npm start
```

テストと Windows ポータブル版のビルド：

```powershell
npm test
npm run dist
```

## フィードバックとライセンス

不具合報告や提案は [Issues](../../issues) から送信できます。アプリが出力する匿名化済み診断ファイルを添付できますが、Last.fm Key、Discogs Token、その他の認証情報は公開しないでください。

プロジェクトのソースコードは [MIT License](LICENSE) で公開します。同梱フォント、ランタイム、ローカルリズムモデル、ローカルジャンルモデルには、それぞれのライセンスが適用されます。詳しくは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
