# SIGNWELL 欣緯科技 官方網站

靜態網站，不需要建置步驟，可直接部署到 GitHub Pages（根目錄已附 `.nojekyll`）。

## 頁面

| 檔案 | 內容 |
| --- | --- |
| `index.html` | 首頁：3D 環形電感、業務範圍、零件 3D 檢視、合作對象、流程、團隊名片盒、詢價 |
| `company.html` | 公司：經營理念、合作角色、企業沿革、公司基本資料 |
| `products.html` | 產品與服務：料號紀錄（搜尋／篩選／3D 檢視／加入詢價單）、電阻判讀、色碼與 SMD 代碼換算、電焊需求、Datasheet 放大鏡、需求自檢 |
| `sourcing.html` | 尋料服務：情境指引（可帶著清單前往詢價）、常見難題、確認原則 |
| `social-responsibility.html` | 社會責任：定期捐款（金額依每月排程自動累加）、服務紀錄 3D 貼紙膠帶（兩筆捐款＋八次服務，按住滑鼠或手指沿路貼在地板） |
| `contact.html` | 聯絡：三種聯繫路徑、商務信箱、常見問題 |
| `rfq.html` | 詢價工具：四步驟、多項料件、貼上清單、詢價單帶入、信件預覽、開啟郵件草稿 |
| `404.html` | 找不到頁面（GitHub Pages 會自動使用） |
| `software.html` | 舊網址，自動轉到首頁團隊區 |

## 資源

- `assets/css/site.css`：全站樣式
- `assets/js/donations.js`：依臺北日期自動累加定期捐款，同步卡片與膠帶數字；每分鐘及回到頁面時檢查日期
- `assets/js/service-tape.js`：服務紀錄膠帶操作（滑鼠／觸控拖曳、重新貼、數字同步）
- `assets/js/app.js`：介面互動（導覽、Tab bar、詢價單、各頁工具）
- `assets/js/scene.js`：3D 場景，以 three.js（MIT License）建置，只在首頁、產品頁與社會責任頁載入；裝置不支援 WebGL 時改顯示靜態圖或清單
- `assets/img/`：零件渲染圖與首頁靜態備援圖
- `assets/fonts/`：Archivo、IBM Plex Mono（SIL Open Font License，授權檔同資料夾）；中文字體由 Google Fonts 載入 Noto Sans TC

## 常見維護

- **新增料號**：在 `products.html` 複製一段 `<article class="part-row">`，同步修改料號、規格、`data-*` 屬性與詢價連結；若要出現在首頁零件檢視器，也在 `index.html` 的 `.lib-list` 複製一個按鈕。`data-pkg` 可用值：`smd-diode`、`sot23-5`、`3216`、`2520`、`qfn3x3-20`。
- **捐款金額**：`social-responsibility.html` 每張捐款卡的 `data-base-amount`（基準金額）、`data-increment`（每月金額）、`data-first-date`（下一次捐款日）、`data-cycle-day`（每月扣款日）。
- **服務紀錄貼紙**：`social-responsibility.html` 的 `.tape-item` 清單同時是 3D 膠帶的資料來源；`data-lines` 用 `|` 分行，`data-bg`／`data-icon` 設定貼紙底色與圖示，新增一筆就會自動印進膠帶。
- **商務信箱**：全站搜尋 `signwell.com.tw@gmail.com`，詢價工具的收件人在 `assets/js/app.js`。

## 服務紀錄互動

在地板區按住滑鼠或手指拖曳，膠帶依路徑貼下；放開或取消觸控即停止，已貼紀錄留在地板上。按「重新貼」可清空地板。第 01、02 張為捐款紀錄，第 03–10 張為服務紀錄。捐款金額沿用原定每月排程，捐款卡、清單與 3D 貼紙同步更新。
