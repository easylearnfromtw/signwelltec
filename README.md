# SIGNWELL 欣緯科技 官方網站

靜態網站，不需要建置步驟，可直接部署到 GitHub Pages（根目錄已附 `.nojekyll`）。

## 頁面

| 檔案 | 內容 |
| --- | --- |
| `index.html` | 首頁：3D 環形電感、業務範圍、零件 3D 檢視、合作對象、流程、團隊名片盒、詢價 |
| `company.html` | 公司：經營理念、合作角色、企業沿革、公司基本資料 |
| `products.html` | 產品與服務：料號紀錄（337 項料號，依類別篩選／搜尋／每頁 24 項分頁／每項附封裝 3D 模型／加入詢價單）、電阻判讀、色碼與 SMD 代碼換算、電焊需求、Datasheet 放大鏡、需求自檢 |
| `sourcing.html` | 尋料服務：情境指引（可帶著清單前往詢價）、常見難題、確認原則 |
| `social-responsibility.html` | 社會責任：定期捐款（金額依每月排程自動累加）、服務紀錄 3D 貼紙膠帶（兩筆捐款＋八次服務，按住滑鼠或手指沿路貼在地板） |
| `medical-responsibility.html` | 欣緯生醫：六幕介紹、藥袋 3D 角色、部門經理與真實網站連結、閱讀流程、資訊查證、個人捐助紀錄與生醫網站入口 |
| `contact.html` | 聯絡：三種聯繫路徑、商務信箱、常見問題 |
| `rfq.html` | 詢價工具：四步驟、多項料件、貼上清單、詢價單帶入、信件預覽、開啟郵件草稿 |
| `404.html` | 找不到頁面（GitHub Pages 會自動使用） |
| `software.html` | 舊網址，自動轉到首頁團隊區 |

## 資源

- `assets/css/site.css`：全站樣式
- `assets/js/donations.js`：依臺北日期自動累加定期捐款，同步卡片與膠帶數字；每分鐘及回到頁面時檢查日期
- `assets/js/service-tape.js`：首屏固定膠帶、滑鼠／觸控拖曳、地面文字與捐款數字同步；手機預設保留捲動，可切換貼膠帶模式
- `assets/js/rfq-mail.js`：與預覽相同的 HTML 剪貼簿、Gmail 寫信連結、HTML／.eml 匯出與複製備援
- `assets/js/gpu-lifecycle.js`：暫停離開畫面或背景分頁的裝飾動畫
- `assets/js/app.js`：介面互動（導覽、Tab bar、詢價單、各頁工具）
- `assets/js/scene.js`：3D 場景，以 three.js（MIT License）建置，只在首頁、產品頁與社會責任頁載入；裝置不支援 WebGL 時改顯示靜態圖或清單。內含封裝模型庫（SOT／SOP／QFN／DFN／TO／SOD／SMA／DIP、各式 LED、電感、保險絲等）
- `assets/css/bio-story.css`、`assets/js/bio-story.js`：欣緯生醫六幕版面與章節導覽，手機以獨立角色區保留完整文字
- `assets/js/bio-bag.js`：僅於生醫介紹頁載入的藥袋角色；本機 three.js 模組及 MIT 授權位於 `assets/vendor/`。不支援 WebGL 時保留靜態藥袋，減少動態偏好與背景分頁會暫停裝飾動畫
- `assets/img/`：零件渲染圖與首頁靜態備援圖；`assets/img/parts/<封裝代碼>.webp` 是料號列表縮圖，也是不支援 WebGL 時的檢視器備援圖
- `assets/fonts/`：Archivo、IBM Plex Mono（SIL Open Font License，授權檔同資料夾）；中文字體由 Google Fonts 載入 Noto Sans TC

## 常見維護

- **新增料號**：在 `products.html` 的 `[data-part-list]` 內複製一段 `<article class="part-row">`，修改 `data-part`（料號）、`data-spec`（品名）、`data-group`（`power` 電源 IC、`mos` 電晶體、`diode` 二極體、`magnetic` 電感、`led` LED 光電、`fuse` 保險絲、`ic` 其他 IC）、`data-cat`／`data-cat-en`（類別）、`data-pkg`（3D 模型）、`data-pkg-label`（封裝顯示文字），以及列內的 `<h3>`、品名文字、縮圖檔名、詢價連結與「加入詢價單」按鈕的 `data-part`／`data-spec`。列表上方的料號總數與手機版類別選單的數字會自動計算；`products.html` 首段文案與首頁「共 337 項」的數字需要手動更新。
- **可用的 3D 模型（`data-pkg`）**：`sot23`、`sot23-5`、`sot23-6`、`sot323`、`sc70-5`、`sot363`、`sot89`、`sot89-5`、`sot223`、`sop8`、`esop8`、`sop14`、`tssop14`、`dip4`、`dip8`、`qfn3x3-16`、`qfn3x3-20`、`dfn3x3-10`、`dfn3x3-12`、`dfn2x3-6`、`tdfn3x3-8`、`dfn1006`、`csp20`、`to252`、`to252-4`、`to263`、`to263-5`、`to220`、`to220-5`、`to220f`、`to251`、`sod123`、`sod123fl`、`sod323`、`sod523`、`sma`、`smd-diode`、`dbs`、`bridge3`、`3216`、`2520`、`axial`、`axind`、`sensor`；需要尺寸或顏色時在底線後加參數：`ww_4x4x3`（繞線功率電感，長×寬×高 mm）、`mold_5x5x3`（一體成型電感）、`drum_8x10`（插件電感 直徑×高）、`cmc_5.0x5.2x2.3`（共模電感）、`chip_0805.ind`／`chip_1812.fuse`（晶片電感／貼片保險絲）、`pptc_y`（插件保險絲，`y` 黃／`o` 橘）、`cled_0603.r`（貼片 LED，尺寸 `0402`／`0603`／`0805`／`1206`／`0605`／`1206r`，顏色 `r` 紅、`g` 綠、`yg` 黃綠、`b` 藍、`y` 黃、`o` 橘、`w` 白、`uv`，雙色用 `.` 連接如 `0605.g.r`）、`dled_5.w`（插件 LED 3 或 5 mm）、`holder_2.g-r`（燈座 LED，數量＋各燈顏色）、`sled_g`（側發光）、`plcc_w`／`plcc_rgb`、`seg7_r`（七段顯示器）、`trilevel_r-y-g`。尺寸後加 `_nd` 會隱藏尺寸標註（用於只有約略尺寸的料號）。縮圖檔名與 `data-pkg` 相同；新的模型參數組合需要另外產生縮圖，否則列表會顯示空白縮圖（3D 檢視仍正常）。
- **捐款金額**：`social-responsibility.html` 每張捐款卡的 `data-base-amount`（基準金額）、`data-increment`（每月金額）、`data-first-date`（下一次捐款日）、`data-cycle-day`（每月扣款日）。
- **服務紀錄貼紙**：`social-responsibility.html` 的 `.tape-item` 清單同時是 3D 膠帶的資料來源；`data-lines` 用 `|` 分行，`data-bg`／`data-icon` 設定貼紙底色與圖示，新增一筆就會自動印進膠帶。
- **商務信箱**：全站搜尋 `luca.sinwell@gmail.com`，詢價工具的收件人在 `assets/js/app.js`。

## 服務紀錄互動

在地板區按住滑鼠或手指拖曳，膠帶依路徑貼下；放開或取消觸控即停止，已貼紀錄留在地板上。按「重新貼」可清空地板。第 01、02 張為捐款紀錄，第 03–10 張為服務紀錄。捐款金額沿用原定每月排程，捐款卡、清單與 3D 貼紙同步更新。

文字與累積投入繪製在 3D 地面，膠帶可以從上方覆蓋。往下捲動時，紀錄面板向上覆蓋固定首屏；完全覆蓋後不再繪製 3D。首頁使用黑底黃色繞線，首頁和靜止的零件檢視器只在互動或畫面變動時繪製，不以降低解析度換取效能。

## 保留排版的詢價信

「複製排版並開啟 Gmail」複製與預覽相同的 HTML，帶入收件人與主旨。使用者在 Gmail 內文貼上後寄出。Gmail 的寫信網址不接受 HTML 內文，靜態 GitHub Pages 也沒有訪客的 Gmail 寄信授權，因此無法自動插入 HTML 或代按傳送。需要完整信件檔時可下載 HTML 或含 HTML／純文字替代版本的 .eml；Gmail 仍使用複製排版方式。
