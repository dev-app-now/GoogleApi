# GGTool

A simple web application to manage Gmail accounts and monitor incoming emails.

[🇻🇳 Tiếng Việt](#tiếng-việt) | [🇺🇸 English](#english)

## English

### Features

- User authentication (register/login)
- Add multiple Gmail accounts
- Monitor incoming emails from specific senders
- Read last email from any sender
- Delete Gmail accounts from the system

### Setup

1. Create a Google Cloud Project:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Enable Gmail API and OAuth2 API
   - Create OAuth2 credentials (Web application)
   - Add authorized redirect URI: `http://localhost:8787/auth/google/callback`

2. Clone and install dependencies:
   ```bash
   git clone <repository-url>
   cd GGTool/api
   npm install
   ```

3. Configure environment variables:
   - Create `.dev.vars` file:
     ```
     JWT_SECRET="your-random-secret"
     GOOGLE_CLIENT_ID="your-google-client-id"
     GOOGLE_CLIENT_SECRET="your-google-client-secret"
     REDIRECT_URI="http://localhost:8787/auth/google/callback"
     ```

4. Run the application:
   ```bash
   npm run dev
   ```

5. Visit `http://127.0.0.1:8787` in your browser

### API Documentation

#### Authentication

- Register: `POST /api/auth/register`
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

- Login: `POST /api/auth/login`
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

#### Gmail Management

- List Gmail accounts: `GET /api/gmail/tokens`
  - Headers: `Authorization: Bearer <token>`

- Add Gmail account: `POST /api/gmail/tokens`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "code": "google-oauth2-code"
  }
  ```

- Delete Gmail account: `DELETE /api/gmail/tokens`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "gmail": "example@gmail.com"
  }
  ```

#### Email Operations

- Wait for email: `POST /api/gmail/wait-for-email`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "gmail": "example@gmail.com",
    "sender": "sender@example.com",
    "timeout": 60
  }
  ```

- Read last email: `POST /api/gmail/read-last-email`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "gmail": "example@gmail.com",
    "sender": "sender@example.com" // optional
  }
  ```

### Demo

1. Register a new account
2. Login with your credentials
3. Click "Add Gmail" to connect your Gmail account
4. Use the "Read Last Email" button to view your latest email
5. Use the API to monitor incoming emails from specific senders

---

## Tiếng Việt

### Tính năng

- Xác thực người dùng (đăng ký/đăng nhập)
- Thêm nhiều tài khoản Gmail
- Theo dõi email đến từ người gửi cụ thể
- Đọc email mới nhất từ bất kỳ người gửi nào
- Xóa tài khoản Gmail khỏi hệ thống

### Cài đặt

1. Tạo dự án Google Cloud:
   - Truy cập [Google Cloud Console](https://console.cloud.google.com)
   - Tạo dự án mới
   - Bật Gmail API và OAuth2 API
   - Tạo thông tin xác thực OAuth2 (Ứng dụng Web)
   - Thêm URI chuyển hướng: `http://localhost:8787/auth/google/callback`

2. Clone và cài đặt dependencies:
   ```bash
   git clone <repository-url>
   cd GGTool/api
   npm install
   ```

3. Cấu hình biến môi trường:
   - Tạo file `.dev.vars`:
     ```
     JWT_SECRET="mã-bí-mật-ngẫu-nhiên"
     GOOGLE_CLIENT_ID="google-client-id-của-bạn"
     GOOGLE_CLIENT_SECRET="google-client-secret-của-bạn"
     REDIRECT_URI="http://localhost:8787/auth/google/callback"
     ```

4. Chạy ứng dụng:
   ```bash
   npm run dev
   ```

5. Truy cập `http://127.0.0.1:8787` trong trình duyệt

### Tài liệu API

#### Xác thực

- Đăng ký: `POST /api/auth/register`
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

- Đăng nhập: `POST /api/auth/login`
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

#### Quản lý Gmail

- Danh sách Gmail: `GET /api/gmail/tokens`
  - Headers: `Authorization: Bearer <token>`

- Thêm Gmail: `POST /api/gmail/tokens`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "code": "google-oauth2-code"
  }
  ```

- Xóa Gmail: `DELETE /api/gmail/tokens`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "gmail": "example@gmail.com"
  }
  ```

#### Thao tác với Email

- Chờ email mới: `POST /api/gmail/wait-for-email`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "gmail": "example@gmail.com",
    "sender": "sender@example.com",
    "timeout": 60
  }
  ```

- Đọc email mới nhất: `POST /api/gmail/read-last-email`
  - Headers: `Authorization: Bearer <token>`
  ```json
  {
    "gmail": "example@gmail.com",
    "sender": "sender@example.com" // không bắt buộc
  }
  ```

### Demo

1. Đăng ký tài khoản mới
2. Đăng nhập với thông tin của bạn
3. Nhấn "Add Gmail" để kết nối tài khoản Gmail
4. Sử dụng nút "Read Last Email" để xem email mới nhất
5. Sử dụng API để theo dõi email đến từ người gửi cụ thể
