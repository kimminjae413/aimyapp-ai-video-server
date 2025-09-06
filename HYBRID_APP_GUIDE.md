# HairGator FaceSwap - 하이브리드 앱 가이드

이 프로젝트는 React 웹앱을 Capacitor를 사용하여 Android 및 iOS 하이브리드 앱으로 변환한 것입니다.

## 📱 주요 기능

### 웹 버전
- 드래그 앤 드롭으로 이미지 업로드
- 파일 선택기를 통한 이미지 업로드
- 얼굴 변환 (Face Swap) 기능
- 비디오 변환 기능

### 모바일 앱 버전 (추가 기능)
- 📷 **네이티브 카메라 연동**: 직접 사진 촬영
- 🖼️ **갤러리 접근**: 기기의 사진 라이브러리에서 선택
- 📱 **모바일 최적화 UI**: 터치 친화적인 인터페이스
- ⚡ **네이티브 성능**: 더 빠른 실행 속도

## 🛠️ 개발 환경 설정

### 필수 요구사항
- Node.js 16+
- Android Studio (Android 개발용)
- Xcode (iOS 개발용, macOS만)

### 초기 설치
```bash
# 의존성 설치
npm install

# 웹 앱 빌드
npm run build

# 네이티브 플랫폼 동기화
npx cap sync
```

## 📋 사용 가능한 스크립트

### 웹 개발
```bash
# 개발 서버 실행
npm run dev

# 웹 앱 빌드
npm run build

# 빌드 미리보기
npm run preview
```

### 하이브리드 앱 개발
```bash
# 웹 빌드 + Capacitor 동기화
npm run cap:build

# Android Studio 열기
npm run cap:android

# Xcode 열기 (macOS만)
npm run cap:ios

# 라이브 리로드 서버 (개발 중)
npm run cap:serve
```

### 수동 Capacitor 명령어
```bash
# 플랫폼 추가
npx cap add android
npx cap add ios

# 웹 코드를 네이티브 앱으로 복사
npx cap copy

# 네이티브 의존성 업데이트
npx cap update

# 전체 동기화 (copy + update)
npx cap sync

# IDE 열기
npx cap open android
npx cap open ios
```

## 🔧 설정 파일

### capacitor.config.ts
```typescript
{
  appId: 'com.hairgator.faceswap',
  appName: 'HairGator FaceSwap',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    Filesystem: {
      permissions: ['storage']
    }
  }
}
```

## 📱 플랫폼별 설정

### Android
- **위치**: `/android/` 폴더
- **권한**: `AndroidManifest.xml`에 카메라 및 저장소 권한 추가됨
- **빌드**: Android Studio에서 실행 또는 `./gradlew assembleDebug`

### iOS
- **위치**: `/ios/` 폴더  
- **권한**: `Info.plist`에 카메라 및 사진 라이브러리 사용 권한 설명 추가됨
- **빌드**: Xcode에서 실행

## 🚀 배포

### Android APK 생성
1. Android Studio에서 프로젝트 열기: `npm run cap:android`
2. Build > Generate Signed Bundle/APK
3. APK 선택 후 릴리스 키로 서명

### iOS App Store 배포
1. Xcode에서 프로젝트 열기: `npm run cap:ios`  
2. Product > Archive
3. App Store Connect에 업로드

## 🎯 모바일 최적화 기능

### 카메라 통합
- `@capacitor/camera` 플러그인 사용
- 네이티브 환경에서는 실제 카메라 API 사용
- 웹 환경에서는 HTML5 파일 입력으로 폴백

### 반응형 UI
- 모바일 환경 자동 감지
- 터치 친화적인 큰 버튼
- 스와이프 및 제스처 지원

### 성능 최적화
- 네이티브 WebView에서 실행
- 더 빠른 로딩 시간
- 오프라인 캐싱 지원

## 🔍 디버깅

### 웹 개발자 도구
```bash
# Chrome에서 Android 앱 디버깅
chrome://inspect/#devices

# Safari에서 iOS 앱 디버깅 (macOS)
Safari > 개발 > [기기명] > [앱명]
```

### 로그 확인
```bash
# Android 로그
npx cap run android -l

# iOS 로그  
npx cap run ios -l
```

## 📝 추가 개발 가이드

### 새 네이티브 기능 추가
1. 필요한 Capacitor 플러그인 설치
2. `capacitor.config.ts`에 플러그인 설정 추가
3. 필요시 네이티브 권한 추가
4. TypeScript 코드에서 플러그인 사용

### 커스텀 네이티브 코드
- Android: `/android/app/src/main/java/` 경로에 Java/Kotlin 코드 추가
- iOS: `/ios/App/App/` 경로에 Swift/Objective-C 코드 추가

## 🐛 문제 해결

### 공통 문제
1. **빌드 실패**: `npm run clean && npm install && npm run cap:build`
2. **권한 오류**: 네이티브 앱의 권한 설정 확인
3. **플러그인 오류**: `npx cap sync` 후 네이티브 IDE에서 클린 빌드

### Android 문제
- Gradle 동기화 실패: Android Studio에서 "Sync Project with Gradle Files"
- 에뮬레이터 문제: API 29+ 에뮬레이터 사용 권장

### iOS 문제  
- CocoaPods 오류: `cd ios/App && pod install`
- 서명 오류: Xcode에서 Development Team 설정

## 📞 지원

문제가 발생하면 다음 리소스를 참조하세요:
- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Capacitor 커뮤니티](https://github.com/ionic-team/capacitor/discussions)
- [Android 개발자 가이드](https://developer.android.com/)
- [iOS 개발자 가이드](https://developer.apple.com/documentation/)