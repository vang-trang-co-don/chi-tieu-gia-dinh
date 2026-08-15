# Chi tiêu gia đình

Web app chi tiêu gia đình đơn giản. Vanilla JS + Firebase Realtime Database, deploy trên GitHub Pages.

## Chạy local (offline, không cần Firebase)

Mở `index.html` bằng Live Server (cần HTTP, không phải `file://`). Khi Firebase chưa kết nối được, app tự dùng `data.json` + `localStorage`. Toàn bộ code nằm trong `js/app.js` (CSS inline trong `index.html`).

```
npx live-server .
# hoặc VS Code → Live Server
```

## Bật Firebase (đồng bộ nhiều thiết bị)

1. Firebase Console → Realtime Database → **Create database**.
2. Import dữ liệu: `data.json` (mục *Import JSON* / *Import file*).
3. Copy web app config (Firebase Console → Project settings → Your apps → SDK configuration) vào biến `FIREBASE_CONFIG` ở đầu `js/app.js`.
4. Rule (bắt buộc — app dùng **Firebase Auth**):

```json
{
  "rules": {
    "data": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

> ⚠️ Không dùng PIN nữa. Rule trên nghĩa là: ai cũng **đọc** được hết, nhưng mọi **ghi** đòi hỏi đăng nhập. Chỉ tài khoản admin (tạo ở Firebase Authentication) đăng nhập được → chỉ admin sửa được.
>
> Bước thêm: Firebase Console → Authentication → Sign-in method → bật **Email/Password** → Users → Add user.

## Deploy GitHub Pages

```
git add -A
git commit -m "initial"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Rồi vào **Settings → Pages → Source: Deploy from a branch → main / root → Save**.

## Cấu trúc dữ liệu (RTDB `data/`)

```
data/
  v: 1                       // version dữ liệu (migration)
  members: [ {id, name} ]
  expenses: [ {id, title, amount, date, payer, split, target?, paid?} ]
```

- `split: "one"` → "Cho 1 người": chọn N người nợ (nút bấm đa chọn, loại trừ payer). Mỗi người được chọn tạo **1 expense record riêng**, amount đầy đủ (không chia), target riêng, nợ/đã-trả riêng.
- `split: "equal"` → chia đều cho tất cả thành viên (kể cả payer), mỗi người chịu `amount / N`, mỗi người khác payer nợ payer phần `amount / N` của họ.
- `paid: { memberId: true }` → member đó đã trả khoản nợ của mình cho expense này.
- Form nhập: số tiền theo lối tắt — `35` + đơn vị **ngàn** = 35.000đ (hoặc chọn đơn vị **triệu** / **đ**).

## Security

- **Firebase Auth (email/password)**: nút ổ khoá 🔒 → modal login. Ai không login chỉ xem; login (admin, cấu hình sẵn trên Firebase Console) thì mới thêm/sửa/xoá/mark đã trả.
- **Rules bắt buộc** (app dùng Firebase Auth):
```json
{
  "rules": {
    "data": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```
- Tạo tài khoản admin: Firebase Console → Authentication → Sign-in method → **Email/Password**: Enable. Sau đó Users → Add user (email + mật khẩu). Chỉ tài khoản này đăng nhập được vào app.
- Khác biệt với bản PIN cũ: giờ `.write` yêu cầu login thật, người ngoài không ghi được. Vì *.read* vẫn mở, ai cũng xem được dữ liệu — muốn giấu dữ liệu cần đóng read (nhưng khi đó guest không xem được nếu không login, trái ý "mọi người chỉ cần mở web là xem").