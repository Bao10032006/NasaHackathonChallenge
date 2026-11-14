# TASK 02A — Báo cáo ổn định Spring Boot Backend Hỏa Lịch

Ngày thực hiện: 14/11/2026  
Phạm vi: ổn định Spring Boot skeleton hiện có; chưa triển khai dataset loader, business service hoặc REST endpoint.

## 1. Initial Project Issues

### 1.1. Dependency graph không phù hợp MVP

`backend/pom.xml` ban đầu đồng thời khai báo:

- `spring-boot-starter-webmvc`
- `spring-boot-starter-webflux`
- `spring-boot-starter-session-jdbc`
- ba starter test riêng cho MVC, WebFlux và JDBC Session
- `spring-boot-devtools`

Hỏa Lịch là public read-only analytical API, không có authentication, HTTP session, reactive requirement hoặc database. Việc giữ cả MVC và WebFlux làm tăng classpath và tạo hai programming model không cần thiết. JDBC Session còn kéo theo kỳ vọng database dù project không có datasource.

### 1.2. Maven Wrapper lỗi trên Windows

Lỗi đã được tái hiện trước khi sửa bằng JDK 21:

```text
icm : Cannot index into a null array.
Cannot start maven from wrapper
```

Nguyên nhân nằm trong `mvnw.cmd`: script truy cập trực tiếp `(Get-Item $MAVEN_M2_PATH).Target[0]`. Trên máy hiện tại, thư mục Maven home không phải symbolic link nên thuộc tính `Target` là `null`; phép truy cập index làm script dừng trước khi Maven được gọi.

### 1.3. Chưa có typed dataset configuration

`application.properties` ban đầu chỉ có application name. Dataset hiện nằm ở `backend/hoalich_data_v1/hoalich_data_v1/`, nhưng chưa có property để loader tương lai nhận đường dẫn tương đối hoặc đường dẫn do môi trường deploy cung cấp.

### 1.4. Test coverage ban đầu quá mỏng

Project chỉ có một `contextLoads()` và chưa kiểm tra:

- dataset property có bind được không;
- environment-style override có hoạt động không;
- context có vô tình yêu cầu datasource/database không.

## 2. Changes Made and Reasons

### 2.1. Giữ nguyên Java/Spring Boot đã chọn

- Giữ `<java.version>21</java.version>`.
- Giữ Spring Boot `4.1.2`.

Spring Boot 4.1.2 là bản stable tại thời điểm thực hiện, yêu cầu tối thiểu Java 17, hỗ trợ tới Java 27 và Maven 3.6.3 trở lên. Vì vậy Boot 4.1.2 tương thích với Java target 21 và Maven Wrapper 3.10.0. Tham chiếu: [Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html).

### 2.2. Tối giản dependency graph

Project giờ chỉ khai báo trực tiếp:

```text
spring-boot-starter-webmvc       compile
spring-boot-starter-validation   compile
spring-boot-starter-test         test
```

`spring-boot-starter-webmvc` kéo Jackson JSON support theo dependency được Boot quản lý; dependency tree thực tế xác nhận `tools.jackson.core:jackson-databind:3.1.7` có mặt. Không cần thêm JSON library thủ công.

Đã loại bỏ WebFlux, JDBC Session, các test starter tương ứng và DevTools. Việc bỏ DevTools giữ runtime/dependency graph gọn cho hackathon; IDE vẫn có thể chạy/restart ứng dụng bình thường.

### 2.3. Sửa Maven Wrapper tối thiểu

Không thay Maven Wrapper version hoặc distribution. `wrapperVersion=3.3.4` và Maven distribution `3.10.0` được giữ nguyên.

Chỉ thay logic đọc symbolic-link target:

- chuyển `Target` thành array an toàn;
- nếu array rỗng/null thì dùng Maven home directory bình thường;
- nếu có target thì tiếp tục dùng target như script cũ.

Sau sửa, `mvnw.cmd -version` hoạt động bằng JDK 21.

### 2.4. Externalize dataset root

Thêm property:

```properties
hoalich.dataset.root=${HOALICH_DATASET_ROOT:hoalich_data_v1/hoalich_data_v1}
```

Đặc điểm:

- default là đường dẫn tương đối theo working directory `backend/`;
- deployment có thể override bằng environment variable `HOALICH_DATASET_ROOT`;
- không chứa absolute path gắn với máy phát triển;
- chưa kiểm tra file, chưa parse và chưa load dataset;
- không sửa bất kỳ dataset artifact nào.

Thêm immutable `DatasetProperties` record dùng `Path`, `@ConfigurationProperties(prefix = "hoalich.dataset")`, `@Validated` và `@NotNull`. `BackendApplication` bật `@ConfigurationPropertiesScan` trong base package hiện tại.

### 2.5. Mở rộng verification tests

Test suite hiện kiểm tra:

1. Spring Boot application context load thành công.
2. Default dataset root bind đúng thành `hoalich_data_v1/hoalich_data_v1`.
3. Context không có `DataSource` bean và không cần database configuration.
4. Property `HOALICH_DATASET_ROOT` override được default location.

Không có REST endpoint hoặc business logic được thêm.

## 3. Files Created, Modified, or Removed

### Modified

| File | Thay đổi |
|---|---|
| `backend/pom.xml` | Tối giản dependencies; giữ Boot 4.1.2 và Java 21 |
| `backend/mvnw.cmd` | Sửa null-safe handling cho Maven home symbolic-link target |
| `backend/src/main/java/com/se201411/mvc/backend/BackendApplication.java` | Bật `@ConfigurationPropertiesScan` |
| `backend/src/main/resources/application.properties` | Thêm relative dataset root và env override |
| `backend/src/test/java/com/se201411/mvc/backend/BackendApplicationTests.java` | Test context, default config và absence của datasource |

### Created

| File | Mục đích |
|---|---|
| `backend/src/main/java/com/se201411/mvc/backend/config/DatasetProperties.java` | Typed externalized dataset configuration |
| `backend/src/test/java/com/se201411/mvc/backend/config/DatasetPropertiesOverrideTests.java` | Xác minh environment-style override |
| `docs/backend/TASK_02A_SPRING_BOOT_STABILIZATION_REPORT.md` | Báo cáo Task 02A |

### Removed

Không xóa file nào. Không rename base package. Không sửa frontend, API contract hoặc dataset.

`backend/target/` được Maven tạo trong quá trình verification và đã nằm trong `.gitignore`; đây không phải source change.

## 4. Dependency Changes

### Removed

- `spring-boot-starter-session-jdbc`
- `spring-boot-starter-webflux`
- `spring-boot-devtools`
- `spring-boot-starter-session-jdbc-test`
- `spring-boot-starter-webflux-test`
- `spring-boot-starter-webmvc-test`

### Retained/added

- Retained `spring-boot-starter-webmvc` làm web stack duy nhất.
- Added `spring-boot-starter-validation` cho Bean Validation và configuration validation.
- Replaced granular test starters bằng `spring-boot-starter-test`, starter chuẩn chứa Spring Boot Test, JUnit và assertion/test utilities.
- JSON support được cung cấp transitively bởi Web MVC starter qua Boot-managed Jackson.

### Dependency verification thực tế

`dependency:tree` xác nhận:

```text
spring-boot-starter-webmvc:4.1.2
  -> spring-boot-starter-jackson:4.1.2
     -> tools.jackson.core:jackson-databind:3.1.7
spring-boot-starter-validation:4.1.2
spring-boot-starter-test:4.1.2 (test)
```

Lọc dependency tree theo WebFlux, JDBC Session, Spring JDBC và Spring Session không trả về dependency nào.

## 5. Java/Maven Environment Used

| Thành phần | Giá trị dùng để verification |
|---|---|
| OS | Windows 11 amd64 |
| Time zone | Asia/Saigon |
| JDK | Oracle JDK 21.0.12 |
| Maven Wrapper script | 3.3.4 |
| Maven distribution | Apache Maven 3.10.0 |
| Spring Boot | 4.1.2 |
| Compiler release | 21 |

Máy cũng có JDK 26 và `JAVA_HOME` mặc định ban đầu trỏ JDK 26. Mọi lệnh verification chính thức trong Task 02A đã đặt `JAVA_HOME=C:\Program Files\Java\jdk-21.0.12` và đưa JDK 21 lên đầu `PATH`.

Trong sandbox, một lần chạy Maven đầy đủ ban đầu thất bại vì Java `user.home` bị sandbox ánh xạ thành `C:\`, khiến Maven thử tạo `C:\.m2\repository`. Lệnh tương đương được chạy ngoài sandbox với đúng user home và thành công. Đây là giới hạn môi trường thực thi của agent, không phải lỗi POM/Wrapper sau sửa.

## 6. Actual Build and Test Results

### Maven Wrapper

Command:

```powershell
.\mvnw.cmd -version
```

Kết quả: exit code `0`; Maven 3.10.0 chạy bằng Java 21.0.12.

### Compiler target

Command:

```powershell
.\mvnw.cmd help:evaluate '-Dexpression=maven.compiler.release' -q -DforceStdout
```

Kết quả: exit code `0`; output `21`.

Compiler log trong build cũng ghi rõ:

```text
Compiling ... with javac [debug parameters release 21]
```

### Clean build, tests và packaging

Command:

```powershell
.\mvnw.cmd clean verify
```

Kết quả thực tế:

```text
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Chi tiết:

- `BackendApplicationTests`: 3 tests pass.
- `DatasetPropertiesOverrideTests`: 1 test pass.
- Spring context chạy bằng Spring Boot 4.1.2 / Java 21.0.12.
- Không cần datasource hoặc JDBC Session configuration.
- Executable JAR được tạo tại `backend/target/backend-0.0.1-SNAPSHOT.jar`.

### Dependency verification

- Required MVC/Validation/Test/Jackson dependencies: có mặt.
- WebFlux/JDBC Session/Spring JDBC/Spring Session: không có trong dependency tree.

## 7. Remaining Issues or Blockers

1. Máy phát triển hiện mặc định dùng JDK 26. Team nên đặt project SDK/JAVA_HOME/CI về JDK 21 để tránh môi trường khác nhau, dù compiler release đã pin 21.
2. Default dataset path chỉ đúng khi ứng dụng được chạy với working directory `backend/`. Khi chạy packaged JAR/container từ vị trí khác, phải đặt `HOALICH_DATASET_ROOT`.
3. Task 02A chưa xác minh dataset directory/file existence khi startup. Việc này thuộc Task 03 cùng loader validation.
4. Chưa có data version/hash manifest chính thức trong configuration; các quyết định contract/science mở từ Task 01 vẫn giữ nguyên.
5. Maven Wrapper Windows đang mang một bản sửa null-safe cục bộ. Nếu sau này nâng Wrapper, cần xác nhận upstream script đã xử lý trường hợp `Target=null` trước khi bỏ patch.
6. Không có business endpoint để integration-test; đây là chủ ý theo phạm vi Task 02A.

Không có blocker kỹ thuật nào còn lại ngăn việc bắt đầu Task 03.

## 8. Readiness for TASK 03 — Dataset Integration

Backend hiện **sẵn sàng cho Task 03**:

- build reproducible qua Maven Wrapper bằng JDK 21;
- dependency graph chỉ còn Spring MVC + Validation + JSON + Test;
- context load không cần database;
- dataset root đã được bind thành typed `Path`, có default tương đối và environment override;
- package hiện có được giữ nguyên;
- dataset chưa bị đọc, sửa hoặc đóng gói lại;
- chưa có REST business endpoint hoặc harmonization logic.

Phạm vi hợp lý cho Task 03 là triển khai read-only dataset loader, startup schema/file validation và immutable in-memory indexes dựa trên `DatasetProperties.root`. Task 03 không nên tự giải quyết các API contract ambiguity đã liệt kê trong báo cáo Task 01.
