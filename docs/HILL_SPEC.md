# Cipher Workbench — Frontend Hill Cipher Specification

## 1. Trạng thái và nguồn có thẩm quyền

Tài liệu này là **đặc tả để triển khai code Frontend** cho tab Hill trong Cipher Workbench. Nguồn
yêu cầu sản phẩm là [Scope Frontend: Hệ mã hóa Hill](<../Scope Frontend_ Hệ mã hóa Hill.html>),
bao gồm các kịch bản UI01–UI13 và prototype minh họa. Prototype giúp đối chiếu tương tác và
vector; mã JavaScript trong file HTML không được đưa vào runtime Frontend.

Cập nhật ngày 30/09/2026: API và thuật toán theo consumer guide, OpenSpec Hill và runtime BE
ở revision [`4505ef7`](https://github.com/kiendt2312/cipher_workbench-be/blob/4505ef776d51d6657f26552531a9809e436318b9/repo_docs/frontend-integration.md).
Contract chính thức dưới đây thay thế dự thảo API ban đầu. Giới hạn BE **5 MiB = 5.242.880 byte**
cho text UTF-8/file Hill ghi đè giới hạn trong HTML nguồn. Quy tắc ưu tiên chung ở
[`BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md).

FE có thể nối tab vào App và kiểm thử bằng API mock trong nhánh triển khai. Tab Hill chỉ xuất
hiện trong **bản phát hành** khi bốn endpoint ở mục 7 hoạt động trên Backend thật, contract đã
được xác nhận và các kịch bản nghiệm thu ở mục 10 đạt. Không phát hành tab có thể bấm nhưng
luôn lỗi 404; không dùng phép tính local hoặc mock làm fallback cho kết quả production.

## 2. Mục tiêu và phạm vi

Thêm Hill vào selector thuật toán hiện tại. Người dùng nhập văn bản hoặc tải file `.txt`, nhập khóa
ma trận cấp 2–4 hoặc từ khóa, thấy tính hợp lệ và nghịch đảo của khóa, rồi mã hóa/giải mã và xem
phép biến đổi theo từng khối. Giao diện phục vụ cả thao tác thường ngày lẫn demo/báo cáo.

Trong phạm vi đợt đầu: toàn bộ FE-H01–FE-H10 và UI01–UI13 của HTML, kể cả các mục được ghi
“Nên có” như khóa ngẫu nhiên, xuất kết quả, xem từng bước và sử dụng ở màn hình 375 px.

Ngoài phạm vi: phá mã bản rõ đã biết, Affine-Hill, khóa cấp trên 4, lịch sử riêng cho Hill, tài
khoản, link chia sẻ và mã hóa/giải mã offline tại Frontend.

## 3. Mô hình thuật toán để giải thích giao diện

```text
A=0, B=1, …, Z=25
x và y là vector hàng dài m; K là ma trận m×m; m ∈ {2, 3, 4}

Mã hóa:  y = x · K mod 26
Giải mã: x = y · K⁻¹ mod 26
K⁻¹ = (det K)⁻¹ · K* mod 26
Khóa hợp lệ ⇔ gcd(det K, 26) = 1
```

`K*` là ma trận phụ hợp. Điều kiện khóa tương đương `det K mod 26` là số lẻ và không chia hết cho 13. Backend tính định thức, nghịch đảo và kết quả; FE chỉ kiểm tra định dạng đầu vào, hiển thị
phân tích và dùng `blocks` Backend trả về để minh họa. FE không tự tính phép nhân ma trận để tạo
result hoặc xác nhận lại result.

Quy tắc văn bản theo Backend:

- Chỉ chữ ASCII `A–Z`/`a–z` tham gia phép biến đổi; giữ kiểu hoa/thường khi đặt chữ kết quả về
  văn bản. Dấu câu, số, khoảng trắng và ký tự không thuộc A–Z giữ nguyên vị trí.
- BE tách cụm gồm ký tự đầu và mọi Unicode Mark theo sau. Chỉ cụm gồm đúng một chữ ASCII
  tham gia khối. Chữ Việt NFC/NFD giữ nguyên toàn cụm và báo W02 khi không bật bỏ dấu.
  Khi bật **Bỏ dấu tiếng Việt**, BE chuyển các cụm chữ Việt hợp lệ (kể cả `đ/Đ`) thành ASCII;
  các cụm Unicode khác giữ nguyên. FE không tự normalize text gửi đi.
- Mã hóa thêm `X` ở cuối khi số chữ A–Z không chia hết cho `m`, báo W01. Giải mã yêu cầu số chữ
  A–Z chia hết cho `m`, nếu không trả E05. Không tự xóa `X` sau giải mã vì không phân biệt được
  chữ gốc với chữ đệm.
- W02 đếm số cụm chữ Việt được giữ nguyên; UI dùng thông báo và details từ BE.
  Padding nối sau toàn bộ văn bản, kể cả dấu câu cuối: `HELLO! → DPDKK!B`.
- Văn bản rỗng hoặc chỉ có khoảng trắng báo E01 tại input. Văn bản có nội dung nhưng không có
  chữ A–Z sau bước chuẩn hóa được Backend báo E02.

Vector tham chiếu: `K=[[3,3],[2,5]]` có `det K mod 26=9`, `(det K)⁻¹=3`,
`K⁻¹=[[15,17],[20,9]]`. `HELP` chia thành `HE`, `LP` và mã hóa thành `DPLE`. `HELLO` mã hóa
thành `DPDKKB` sau khi thêm một `X` và báo W01. Các vector chỉ là oracle để test; result trong
ứng dụng luôn lấy từ response Backend.

## 4. Vị trí trong Workbench và bố cục

- Dùng header, selector, mode toggle, theme sáng/tối, typography, nút và thông báo của
  Workbench; không nhúng nguyên file HTML, không thêm router hoặc trang Hill độc lập.
- Trong tab Hill, desktop có hai cột: **trái** là văn bản, khóa, tùy chọn bỏ dấu và nút chính;
  **phải** là kết quả và panel phân tích khóa. Ở 375 px, xếp chồng theo thứ tự trái rồi phải,
  không cuộn ngang toàn trang.
- Theo yêu cầu UI cập nhật: đầu vào và kết quả dùng chung panel, header, typography, padding,
  status và màu ký tự hoa/thường/khác của Workbench. Bỏ viền màu sáng riêng của các panel Hill,
  khung lồng bên trong vùng văn bản và viền sáng quanh khối kết quả. Khối vẫn có tooltip/focus;
  viền control trung tính, trạng thái lỗi và focus bàn phím giữ rõ trong cả hai theme.
- Kết quả tô theo từng khối. Hover **hoặc focus bằng bàn phím** lên khối hiển thị vector đầu vào,
  ma trận đang áp dụng và vector đầu ra từ `blocks`; không cần FE tính lại tích ma trận.
- `StepViewer` nằm trong ô **Phân tích khóa**, dưới thông tin khóa, mặc định thu gọn; khi mở, liệt kê từng khối, vector, `x·K` hoặc `y·K⁻¹`, kết quả
  modulo 26. Sao chép và tải `.txt` dùng đúng chuỗi `result` của Backend, không dùng chuỗi đã
  tô màu hoặc định dạng cho demo.
- Lưới ma trận đi bằng Tab và phím mũi tên; tất cả control dùng được bằng bàn phím. Tooltip,
  trạng thái phân tích, lỗi và cảnh báo có nhãn/announcement phù hợp cho screen reader.

## 5. Draft, chuyển tab và luồng tương tác

Draft Hill tối thiểu gồm `inputType`, `text`, `file`, `fileText`, `mode`, `m`, `keyInputMode`, `matrix` dạng chuỗi thô,
`keyword`, `stripDiacritics`, `keyAnalysis`, `result`, `warnings`, `fileError` và trạng thái request.
Giữ chuỗi thô của từng ô để báo E03 đúng hàng/cột trước khi parse.

1. Lần đầu mở Hill, lấy **văn bản đang gõ** từ tab hiện tại; không tự lấy nội dung file đang chọn ở
   tab khác. Khởi tạo `m=2`, `K=[[3,3],[2,5]]`, mode mã hóa và gọi phân tích khóa một lần.
2. Sau lần đầu, mỗi tab giữ bản nháp riêng. Đổi Caesar ↔ Hill không làm mất văn bản/khóa của
   từng tab. Theo hành vi Workbench hiện tại, đổi tab xóa result/notice cũ; **Làm mới** reset toàn
   bộ draft và quay về Caesar.
3. Sửa khóa: FE kiểm tra đủ `m×m` ô và số nguyên; khi đúng định dạng, debounce 300 ms rồi gọi
   `/key/analyze`. Hủy request cũ và bỏ qua response đã lỗi thời. Nút mã hóa/giải mã chỉ mở khi
   có văn bản, khóa đã được Backend xác nhận hợp lệ và không có request chặn thao tác.
4. Đổi `m`: dựng lưới mới và lấy khóa hợp lệ từ `/key/random?m=`. Bấm **Khóa ngẫu nhiên** gọi
   cùng endpoint. FE không tự sinh hoặc tự kiểm tra tính khả nghịch của khóa ngẫu nhiên.
5. Chế độ từ khóa chỉ nhận đúng `m²` chữ `[A-Za-z]` (ví dụ `HILL` → lưới
   `[[7,8],[11,11]]`). Lưới hiển thị được suy ra bằng A=0…Z=25; request phân tích và xử lý
   gửi `keyword,m` thay cho `key`. Backend vẫn quyết định khóa có khả nghịch hay không.
6. Sửa text, mode, khóa, cấp `m`, tùy chọn bỏ dấu hoặc file phải xóa result/notice cũ. Trong lúc
   xử lý, khóa các control có thể thay đổi request. Theme vẫn có thể đổi.
7. Sau response thành công, hiển thị nguyên văn `result`, `blocks`, phân tích khóa và cảnh báo.
   Bấm nút của W02 bật **Bỏ dấu tiếng Việt** và gửi lại request với tùy chọn mới. Khi lỗi mạng
   hoặc 5xx, result rỗng và có **Thử lại**.

## 6. Validation và file

### Khóa

- `m` chỉ nhận 2, 3 hoặc 4 từ select. Nếu BE trả E08, hiện nguyên message tại vùng khóa,
  khóa submit cho tới khi người dùng sửa khóa/cấp ma trận.
- Mỗi ô lưới phải là số nguyên ASCII có dấu âm tùy chọn và nằm trong phạm vi số nguyên JavaScript
  biểu diễn chính xác. FE gửi **giá trị nguyên gốc** cho Backend, kể cả `-3` hoặc `29`; Backend
  chuẩn hóa modulo 26. Không lặng lẽ cắt, làm tròn hoặc đổi giá trị người dùng nhập.
- Từ khóa có đúng `m²` chữ ASCII; không tự trim, bỏ dấu hoặc loại ký tự sai. Nếu sai, báo E09 và
  không gọi phân tích.
- Kiểm tra định dạng ở FE không thay thế E04 từ Backend. Panel phân tích hiển thị det, ƯCLN,
  `(det)⁻¹`, `K*`, `K⁻¹`, trạng thái loading/valid/invalid và W03 nếu Backend trả.

### File `.txt`

- Hill dùng chung `CipherInputPanel` với các thuật toán khác: nguồn **Văn bản / File .txt**,
  vùng chọn/kéo thả file (chú thích chung: **Chỉ nhận file .txt UTF-8, tối đa 5 MiB**),
  thẻ tên và kích thước, xem trước tối đa 5.000 ký tự, đổi/gỡ file,
  sao chép và xóa. Văn bản gõ và file có draft riêng; chuyển nguồn không làm mất draft.
- File có đuôi `.txt` không phân biệt hoa/thường và tối đa **5 MiB = 5.242.880 byte gốc**.
  Đọc tại client bằng UTF-8 nghiêm ngặt. Khi chọn nguồn file, toàn bộ `fileText` gửi qua JSON
  text như contract Hill; không gửi bản xem trước bị cắt và không gọi endpoint file.
- Sai đuôi báo `Chỉ chấp nhận file .txt.`; vượt giới hạn báo E06. Không giải mã được UTF-8 báo E07. Các trường hợp này giữ
  nguyên draft văn bản, file hợp lệ và result trước khi thử file. Lỗi ở vùng input khóa submit
  cho nguồn file đến khi chọn lại/gỡ file; file rỗng dẫn đến E01 sau khi đọc.
- Văn bản gõ cũng giới hạn 5.242.880 byte UTF-8 trước normalization hoặc bỏ dấu. Kiểm tra
  giới hạn trước kiểm tra blank theo precedence Backend. Đúng ngưỡng được nhận; thêm một byte
  báo `Văn bản vượt quá giới hạn 5 MiB.` và khóa nút chính.
- Tải kết quả tạo file `.txt` UTF-8 từ chính `result` Backend trả về. Copy và download phải giữ
  nguyên khoảng trắng, dấu câu, kiểu hoa/thường và `X` đệm nếu có.

## 7. Contract chính thức để triển khai FE

Tất cả URL dùng same-origin `/api`; không hard-code host Backend. Không có runtime mock/fallback.

| Endpoint                         | Request                                                | HTTP 200                                                           |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| `POST /api/hill/key/analyze`     | `{key}` hoặc `{keyword,m}`; không gửi text/options     | `{success:true,result:HillKeyAnalysis,warnings}`                   |
| `GET /api/hill/key/random?m={m}` | `m=2                                                   | 3                                                                  | 4` đúng một lần | Như analyze, gồm toàn bộ phân tích khóa |
| `POST /api/hill/encrypt`         | `{text,key,options?}` hoặc `{text,keyword,m,options?}` | `{success:true,result:string,blocks,key:HillKeyAnalysis,warnings}` |
| `POST /api/hill/decrypt`         | Như encrypt                                            | Như encrypt                                                        |

```ts
type HillSize = 2 | 3 | 4;
type HillKeyPayload =
  { key: number[][]; keyword?: never; m?: never } | { keyword: string; m: HillSize; key?: never };
type HillProcessRequest = HillKeyPayload & {
  text: string;
  options: { stripDiacritics: boolean; padChar: "X" };
};
interface HillKeyAnalysis {
  matrix: number[][]; // chuẩn hóa 0..25
  m: HillSize;
  det: number; // det K mod 26, 0..25
  gcd: number; // success luôn 1
  detInverse: number;
  adjugate: number[][];
  inverse: number[][];
}
interface HillBlock {
  input: number[]; // đúng m phần tử, 0..25
  output: number[]; // đúng m phần tử, 0..25
}
interface HillWarning {
  code: "W01" | "W02" | "W03";
  message: string;
  details: Record<string, unknown>;
}
interface HillAnalyzeResponse {
  success: true;
  result: HillKeyAnalysis;
  warnings: HillWarning[];
}
type HillRandomResponse = HillAnalyzeResponse;
interface HillProcessResponse {
  success: true;
  result: string;
  blocks: HillBlock[];
  key: HillKeyAnalysis;
  warnings: HillWarning[];
}
interface HillBusinessErrorResponse {
  success: false;
  message: string;
  code: string;
  details: Record<string, unknown>;
}
```

Ví dụ request lưới: `{text:"HELP",key:[[3,3],[2,5]],options:{stripDiacritics:false,padChar:"X"}}`.
Không gửi `m` với `key`. Request từ khóa: `{text:"HILLCIPHER",keyword:"HILL",m:2}`.
BE từ chối field thừa/trùng. Options mặc định `stripDiacritics=false`, `padChar="X"`;
FE dùng X cố định. Không có `/api/hill/file`; FE đọc `.txt` rồi gửi JSON.

Transform trả `key.matrix`, `key.adjugate`, `key.inverse` đã chuẩn hóa; `blocks` chứa toàn bộ
khối, kể cả padding. Analyze/random trả cùng cấu trúc phân tích trong **`result`**; random
được dùng trực tiếp, không gọi analyze lần nữa. Random không trả ma trận đơn vị; tự nghịch đảo
vẫn được phép và báo W03. Analyze/random không tạo bản ghi history. Transform từ file FE đọc
vẫn là `source=text` ở history BE.

Warning luôn có details và theo thứ tự W01, W02, W03:

- W01: `{count,char,m}` cho padding mã hóa.
- W02: `{count}` cho cụm chữ Việt giữ nguyên.
- W03: `{reason:"identity"|"self_inverse"}` cho khóa; có thể xuất hiện ở cả bốn endpoint.

Lỗi nghiệp vụ dùng envelope phẳng ở trên, HTTP 422; riêng E06 là 413.
500 bất ngờ và guard hạ tầng 64 MiB dùng `{success:false,message}` không có E-code.
FE giữ nguyên message hợp lệ của BE, chỉ dùng code/details để chọn vùng hiển thị/control.
Network, JSON/schema sai dùng thông báo chung; không suy diễn hoặc tạo kết quả thay thế.

Thứ tự validation transform BE: guard 64 MiB → wire E11 → text byte E06 → text E01 →
key E03/E08/E09 → options E10 → khả nghịch E04 → không có chữ E02 → decrypt E05.

## 8. Vị trí lỗi và cảnh báo

Mọi message BE được hiển thị nguyên văn, không dựng lại câu từ det/n/m hoặc branch theo câu chữ.
Local validation dùng thông báo trong HTML với giới hạn 5 MiB mới.

| Mã  | Vị trí / details                                                       |
| --- | ---------------------------------------------------------------------- |
| E01 | Dưới textarea; text thiếu/null/blank                                   |
| E02 | ResultPanel; không có chữ tham gia khối                                |
| E03 | Dưới lưới; `reason`, `row/column` 1-based dùng đánh dấu ô lỗi          |
| E04 | KeyAnalysisPanel, khóa submit; `det,gcd,divisor`                       |
| E05 | ResultPanel; `n,m`                                                     |
| E06 | Dưới textarea hoặc cạnh nút file; `actualBytes,maxBytes`               |
| E07 | FE khi UTF-8 lỗi, cạnh nút file, giữ draft                             |
| E08 | Vùng khóa/cấp ma trận; `min,max,m?`                                    |
| E09 | Dưới ô từ khóa; `m,expected,actual`                                    |
| E10 | Cạnh tùy chọn; `field`                                                 |
| E11 | ResultPanel cho transform; panel phân tích nếu analyze/random lỗi wire |
| W01 | Dưới kết quả, thông báo padding                                        |
| W02 | Dưới kết quả, nút bật bỏ dấu và gửi lại                                |
| W03 | KeyAnalysisPanel và warnings của transform                             |

Lỗi khóa từ transform cũng vô hiệu phân tích hiện có và khóa submit. Network/schema sai dùng
**“Không kết nối được máy chủ. Thử lại.”**; lỗi hệ thống có message hợp lệ dùng message BE.
Nút Thử lại gọi đúng thao tác đã lỗi (analyze, random hoặc transform). FE không dùng result cũ
sau lỗi.

## 9. Thành phần và phân chia trách nhiệm

| Thành phần                                               | Trách nhiệm                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `CipherAlgorithmSelector`, `CipherModeSelector` (có sẵn) | Selector/mode của Workbench; App giữ draft theo mục 5.                          |
| `HillTextInput`                                          | Textarea, tải `.txt`, validation E01/E06/E07.                                   |
| `HillKeyMatrixInput`                                     | Cấp `m`, lưới, từ khóa, di chuyển bằng bàn phím, E03/E09.                       |
| `HillKeyAnalysisPanel`                                   | Trạng thái request, det, gcd, detInverse, K*, K⁻¹, E04/W03.                     |
| `HillResultPanel`, `HillBlockTooltip`, `HillStepViewer`  | Chỉ tiêu thụ `result` và `blocks` từ BE; hiển thị, copy, download và bước tính. |
| `Notification` (có sẵn) và notice nội tuyến Hill         | Đặt lỗi/cảnh báo đúng vùng, đúng câu; W02 có hành động chạy lại với bỏ dấu.     |
| `useHillCipher`, `hillApi`                               | Request, debounce, abort/stale response, trạng thái xử lý và retry.             |

### 9.1 Cấu trúc code cần tạo

| Đường dẫn                                                  | Việc triển khai                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/features/hill/types/cipher.ts`                        | Kiểu draft, matrix, analysis, block, warning, result và lỗi API.                                   |
| `src/features/hill/utils/validation.ts`                    | E01/E03/E09, parser số nguyên chính xác, đổi từ khóa thành lưới chỉ để hiển thị.                   |
| `src/features/hill/utils/fileText.ts`                      | Kiểm tra đuôi/kích thước, đọc `ArrayBuffer` bằng `TextDecoder("utf-8", { fatal: true })`, E06/E07. |
| `src/features/hill/services/hillGateway.ts`                | Interface bốn lời gọi API để hook nhận gateway qua dependency injection.                           |
| `src/features/hill/services/hillApi.ts`                    | `fetch` same-origin, `AbortSignal` cho analyze, parse/kiểm tra response và map lỗi.                |
| `src/features/hill/hooks/useHillCipher.ts`                 | Draft, analysis/result state, debounce, abort, random, file read, submit, retry, reset.            |
| `src/features/hill/components/`                            | `HillWorkspace`, input, khóa, phân tích khóa, output, tooltip và bước tính.                        |
| `src/app/App.tsx`, `src/shared/config/cipherAlgorithms.ts` | Đăng ký tab, chuyển văn bản lần đầu, giữ draft và reset toàn Workbench.                            |
| `src/app/styles.css`                                       | CSS `.hill-*` và semantic color tokens cho light/dark, responsive 375 px.                          |

Dùng lại `CipherModeSelector`, `HighlightedTextArea`, khung panel/nút/theme và `saveBlob` từ
shared. Hill dùng chung `CipherInputPanel`; hook Hill chọn `text` hoặc `fileText` của nguồn hiện tại
để gửi JSON. UI file chung không quyết định transport Backend. `readJsonSuccess` hiện chỉ nhận `{success:true,result}` nên
Hill cần parser response riêng cho `blocks/key/warnings`. Test mock ở gateway/fetch boundary;
không đặt mock trong runtime.

### 9.2 State và điều kiện chuyển trạng thái

```text
mode: encrypt | decrypt
text: string
m: 2 | 3 | 4
keyInputMode: grid | keyword
matrix: string[][]                 // chuỗi thô, báo E03 đúng ô
keyword: string
stripDiacritics: boolean
analysis: idle | loading | valid | invalid | error
result: idle | loading | done | error
fileError: null | E06 | E07
```

`analysis` lưu fingerprint của khóa đã được Backend phân tích. `canSubmit` chỉ đúng khi
nội dung nguồn hiện tại (`text` hoặc toàn bộ `fileText`) hợp lệ và không có lỗi file,
validation khóa FE đạt, `analysis=valid` **cho đúng fingerprint khóa
hiện tại**, không đang đọc file/random/analyze/process và không có request submit khác. Ngay khi
sửa khóa, vô hiệu analysis cũ và khóa nút chính, kể cả trong 300 ms debounce. E04 là `invalid`;
lỗi mạng/5xx của analyze là `error` với nút Thử lại. Không coi response của khóa cũ là hợp lệ
cho khóa mới.

Mọi action thay đổi draft xóa result/warnings/error submit cũ. File sai E06/E07 không thay đổi
draft đang có. Submit lấy snapshot `text/mode/key/options` trước request, khóa các control thay
đổi snapshot trong lúc chờ, và chỉ nhận result cho snapshot đó. Retry chỉ gửi lại khi draft vẫn
giống snapshot lỗi; nếu người dùng sửa draft, lỗi cũ biến mất và nút chính dùng dữ liệu mới.

### 9.3 Luồng request cần code

1. Mở Hill lần đầu: điền draft theo mục 5, gọi `analyze` cho khóa mặc định ngay một lần.
2. Sửa ô hoặc keyword: FE validate đồng bộ. Nếu sai, hiện E03/E09 và không gọi API. Nếu đúng,
   hẹn `analyze` sau 300 ms; cleanup timer, `AbortController` và request id khi khóa đổi hoặc
   tab không còn active hoặc component unmount. Chỉ response có id mới nhất được cập nhật panel.
3. Đổi cấp `m` hoặc bấm random: gọi `random(m)`, kiểm tra ma trận trả về có đúng `m×m` số
   nguyên và phân tích đầy đủ, điền lưới và dùng analysis trả về trực tiếp. Không dùng kết quả random của cấp `m` cũ khi user
   đổi cấp lần nữa.
4. Submit: gửi `encrypt` hoặc `decrypt` với **một** trong `key` hoặc `keyword,m`, text và options. Clear
   result cũ ngay; success hiển thị nguyên `result/blocks/key/warnings`, lỗi hiển thị tại vùng
   theo mã ở mục 8.
5. Bấm nút W02: bật `stripDiacritics`, clear result và gửi lại cùng text/mode/khóa với options
   mới. Nút Thử lại cho lỗi mạng/5xx gửi lại request còn hiệu lực.

Service parse response như dữ liệu `unknown`: kiểm tra HTTP status, JSON object, kiểu các trường
bắt buộc, kích thước matrix/block và mã warning/error trước khi chuyển cho hook. Response 422
giữ `code/details` và nguyên message để UI đặt lỗi đúng chỗ. Network/schema sai dùng thông báo
chung; lỗi hệ thống JSON hợp lệ giữ message BE. Không tạo result giả.

### 9.4 Hiển thị theo khối mà không tính mật mã tại FE

Render **chuỗi `result` của Backend** theo cụm ký tự đầu + mọi Unicode Mark theo sau,
như core BE. Chỉ cụm gồm đúng một `[A-Za-z]` tham gia đếm; không đếm ASCII base trong chữ
Việt NFD được giữ nguyên. Mỗi `m` chữ hợp lệ gắn với `blocks[i]`; dấu câu/Unicode khác giữ
nguyên cả cụm, padding ở cuối text. Tooltip và StepViewer đọc vector BE, mã hóa dùng
`key.matrix`, giải mã dùng `key.inverse` trong response. FE không tính lại phép nhân.
Nếu số chữ tham gia trong result không khớp `blocks.length × m`, coi là response sai schema.

### 9.5 Công việc và bằng chứng hoàn thành

| Task HTML      | Code cần có                                            | Bằng chứng FE trước khi có Backend                                      |
| -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| FE-H01, FE-H10 | App registration, draft transfer, responsive, keyboard | Component/App test đổi tab và viewport 375 px.                          |
| FE-H02, FE-H03 | Input khóa, validation, analysis panel                 | E03/E04/E09, đổi `m`, keyword, debounce/abort bằng gateway mock.        |
| FE-H04         | Textarea, đọc file                                     | E01/E06/E07, biên 5.242.880 byte, textarea không mất khi file lỗi.      |
| FE-H05, FE-H08 | Result, block tooltip, steps                           | Fixture `HELP → DPLE`, focus/hover và từng vector.                      |
| FE-H06         | Error/warning mapping                                  | Mỗi mã ở mục 8 đúng vị trí/câu; W02 chạy lại.                           |
| FE-H07         | Random, copy, download                                 | Request random đúng `m`; clipboard/file chứa đúng result UTF-8.         |
| FE-H09         | Service và hook                                        | Payload/response parser, debounce 300 ms, abort, stale response, retry. |

Các test trên dùng fixture API ở mục 7, không cần Backend đang chạy. Sau khi có Backend, chạy
thêm integration E2E thật để xác nhận cùng các kịch bản UI01–UI13.

## 10. Kiểm thử và nghiệm thu

Các kịch bản dưới đây là cổng nghiệm thu **bắt buộc của đợt đầu**, dù một số task FE-H07/08/10
được HTML đánh dấu “Nên có”.

| ID   | Hành vi cần kiểm                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------ |
| UI01 | Khóa mặc định + `HELP` → `DPLE`, hai khối, det 9 và `(det)⁻¹=3`.                                       |
| UI02 | `[[2,4],[1,3]]` → E04 det 2, nút chính bị khóa.                                                        |
| UI03 | Ô khóa `a` → E03 đúng hàng/cột, không gọi API.                                                         |
| UI04 | `HELLO` → `DPDKKB` và W01.                                                                             |
| UI05 | Giải mã `DPL` → E05 ở ResultPanel.                                                                     |
| UI06 | Từ khóa `HIL` ở `m=2` → E09, hiện có 3/4 chữ.                                                          |
| UI07 | Từ khóa `HILL`, `HILLCIPHER` → lưới `[[7,8],[11,11]]`, result `HOQBYAAPHL`.                            |
| UI08 | File `.pdf` báo sai đuôi; `.txt` 5.242.881 byte → E06, textarea giữ nguyên; file 2 MiB qua size check. |
| UI09 | `Tiếng Việt` → W02; bấm bỏ dấu và xử lý lại thì hết W02.                                               |
| UI10 | Đổi `m=2` sang 3 → lưới 3×3 từ random endpoint và phân tích hợp lệ.                                    |
| UI11 | Hover/focus khối `DP` → `[7, 4] · K = [3, 15]`.                                                        |
| UI12 | Gõ nhanh năm ký tự vào ô khóa → một request analyze sau khi dừng gõ.                                   |
| UI13 | Backend mất kết nối → thông báo và nút Thử lại.                                                        |

Ngoài ra: kiểm tra file UTF-8 lỗi, biên 5.242.880 byte và text UTF-8 đa byte trước bỏ dấu, giá trị ma trận âm/lớn nhưng chính xác,
request cũ bị hủy, copy/download UTF-8, theme sáng/tối, Tab/phím mũi tên/focus, 375 px không
cuộn ngang. Unit/component test được mock tại biên API; integration E2E phải chạy với Backend
thật và revision contract đã ghim. Lint, format, typecheck, test và build phải đạt trước khi phát
hành.

## 11. Hai mốc hoàn thành

**Mốc A — code FE và fixture theo contract chính thức:**

1. Tạo type, validation, file reader và Hill gateway/service theo mục 6–7; viết fixture phản hồi
   đúng vector HTML. Test payload, lỗi 422/network/5xx, UTF-8 và giới hạn byte.
2. Viết hook state theo mục 9.2–9.3; test khóa mặc định, debounce/abort, E03/E04/E09, random
   khi đổi `m`, snapshot submit, W02 và retry bằng gateway mock.
3. Tạo component và CSS theo mục 4, 9.1, 9.4; test UI01–UI13 với mock **chỉ ở test boundary**.
   Nối App/selector trong nhánh triển khai để kiểm tra chuyển tab và reset; không đổi luồng của
   các cipher đang có.
4. Chạy format, lint, typecheck, unit/component test, build và mock browser test ở desktop/375
   px. Phân biệt bằng chứng gateway mock với bằng chứng gọi Backend thật.

**Mốc B — được đưa Hill ra bản phát hành:**

1. Dùng Backend chứa `4505ef7` hoặc revision tương thích mới hơn; mục 3, 7, 8 và fixture FE
   đã đồng bộ với contract chính thức. Đối chiếu lại nếu BE thay schema trước release.
2. Chạy UI01–UI13 và các trường hợp file/keyboard/mobile bằng Backend thật qua `/api`, trên
   revision sẽ deploy. Chỉ bật tab Hill trong bản phát hành khi tất cả đạt.
3. Nếu Backend chưa sẵn sàng, giữ Hill trong nhánh/feature chưa phát hành; không công bố là
   “Khả dụng” và không dùng tính toán local làm phương án thay thế.

## 12. Bằng chứng đồng bộ contract ngày 30/09/2026

- Adapter, hook, UI và fixture dùng schema chính thức BE `4505ef776d51d6657f26552531a9809e436318b9`.
- Backend integration: **20/20** ca Playwright trên desktop và 375 px, không mock response mật mã.
  Bao gồm default/padding/decrypt/download, keyword+m, E04/E05, NFD/W02, random cấp 3/4,
  file UTF-8, giới hạn text đúng 5 MiB, debounce, network retry và vector ACT→QRT/TEST→FNMP.
- Unit/component FE: **218/218**, trong đó 34 ca Hill/App; lint, typecheck và production build đạt.
- Cấu hình riêng: `playwright.hill-integration.config.ts`, script `test:e2e:hill:integration`.
  Chạy với checkout BE đã chứa revision trên:

```bash
BACKEND_CONTEXT=/path/to/backend-at-4505ef7 npm run test:e2e:hill:integration
```

Nếu kiểm thử một instance đã chạy, dùng `PLAYWRIGHT_BASE_URL` trỏ tới FE bật Hill và proxy đúng BE.
Test đã chạy bằng clone BE riêng ở revision ghim; không chứng minh Backend deploy hiện tại đã cập nhật.
`VITE_ENABLE_HILL=false` vẫn là mặc định. Sau khi build/restart Backend chứa Hill (và migrate `0002`
nếu dùng PostgreSQL), đặt `VITE_ENABLE_HILL=true` rồi build FE để phát hành tab.
