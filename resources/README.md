# App Resources

이 폴더에는 앱 아이콘과 스플래시 스크린 리소스가 들어있습니다.

## 아이콘 가이드라인

### Android
- `icon-foreground.png` - 432x432px (적응형 아이콘용 전경)
- `icon-background.png` - 432x432px (적응형 아이콘용 배경)
- `icon.png` - 1024x1024px (기본 아이콘)

### iOS
- `icon.png` - 1024x1024px

## 스플래시 스크린
- `splash.png` - 2732x2732px (정사각형, 센터 정렬됨)
- `splash-dark.png` - 2732x2732px (다크 모드용, 선택사항)

## 자동 생성
아이콘과 스플래시 스크린을 추가한 후, 다음 명령어로 모든 크기를 자동 생성할 수 있습니다:

```bash
npx capacitor-assets generate
```