#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <wrl.h>
#include <WebView2.h>
#include <WebView2EnvironmentOptions.h>

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "resource.h"

#pragma comment(lib, "Ole32.lib")
#pragma comment(lib, "Shell32.lib")

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowTitle[] = L"虚空天机计算盘 V4.1.0";
constexpr wchar_t kWindowClass[] = L"CyberDice.NativeWindow";
constexpr wchar_t kFallbackPageName[] = L"Cyber-Dice-4.1.0.html";
constexpr wchar_t kVirtualHost[] = L"cyber-dice.local";
constexpr wchar_t kVirtualUrl[] = L"https://cyber-dice.local/index.html";
constexpr wchar_t kAssetVersion[] = L"4.1.0";
constexpr int kDefaultClientWidth = 1180;
constexpr int kDefaultClientHeight = 820;
constexpr int kMinimumClientWidth = 640;
constexpr int kMinimumClientHeight = 520;

HINSTANCE g_instance = nullptr;
HWND g_mainWindow = nullptr;
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webView;
std::string g_composedHtml;
bool g_fallbackOpened = false;

std::vector<char> LoadResourceBytes(int resourceId) {
  const HRSRC resource =
      FindResourceW(g_instance, MAKEINTRESOURCEW(resourceId), RT_RCDATA);
  if (resource == nullptr) {
    return {};
  }

  const HGLOBAL loaded = LoadResource(g_instance, resource);
  if (loaded == nullptr) {
    return {};
  }

  const DWORD size = SizeofResource(g_instance, resource);
  const auto* data = static_cast<const char*>(LockResource(loaded));
  if (data == nullptr || size == 0) {
    return {};
  }

  return std::vector<char>(data, data + size);
}

std::string LoadResourceString(int resourceId) {
  const std::vector<char> bytes = LoadResourceBytes(resourceId);
  return std::string(bytes.begin(), bytes.end());
}

bool ReplaceOnce(std::string& content, const std::string& search,
                 const std::string& replacement) {
  const size_t position = content.find(search);
  if (position == std::string::npos) {
    return false;
  }

  content.replace(position, search.size(), replacement);
  return true;
}

std::string Base64Encode(const std::vector<char>& input) {
  static constexpr char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string output;
  output.reserve(((input.size() + 2) / 3) * 4);

  for (size_t index = 0; index < input.size(); index += 3) {
    const unsigned int first =
        static_cast<unsigned char>(input[index]);
    const unsigned int second =
        index + 1 < input.size()
            ? static_cast<unsigned char>(input[index + 1])
            : 0;
    const unsigned int third =
        index + 2 < input.size()
            ? static_cast<unsigned char>(input[index + 2])
            : 0;
    const unsigned int combined = (first << 16) | (second << 8) | third;

    output.push_back(alphabet[(combined >> 18) & 0x3f]);
    output.push_back(alphabet[(combined >> 12) & 0x3f]);
    output.push_back(index + 1 < input.size()
                         ? alphabet[(combined >> 6) & 0x3f]
                         : '=');
    output.push_back(index + 2 < input.size()
                         ? alphabet[combined & 0x3f]
                         : '=');
  }

  return output;
}

std::string BuildEmbeddedDocument() {
  std::string html = LoadResourceString(IDR_INDEX_HTML);
  const std::string css = LoadResourceString(IDR_STYLES_CSS);
  const std::string javaScript = LoadResourceString(IDR_APP_JS);
  const std::string qrCodeJavaScript =
      LoadResourceString(IDR_QRCODE_JS);
  const std::string html2CanvasJavaScript =
      LoadResourceString(IDR_HTML2CANVAS_JS);
  const std::vector<char> appleTouchIcon =
      LoadResourceBytes(IDR_APPLE_TOUCH_PNG);
  const std::vector<char> formaImage = LoadResourceBytes(IDR_FORMA_PNG);

  const bool cssInjected = ReplaceOnce(
      html, R"(  <link rel="stylesheet" href="styles.css?v=4.1.0">)",
      "  <style>\n" + css + "\n  </style>");
  const bool scriptInjected = ReplaceOnce(
      html, R"(  <script src="app.js?v=4.1.0"></script>)",
      "  <script>\n" + javaScript + "\n  </script>");
  const bool qrCodeInjected = ReplaceOnce(
      html, R"(  <script src="vendor/qrcode-generator.js?v=4.1.0"></script>)",
      "  <script>\n" + qrCodeJavaScript + "\n  </script>");
  const bool html2CanvasInjected = ReplaceOnce(
      html, R"(  <script src="vendor/html2canvas.min.js?v=4.1.0"></script>)",
      "  <script>\n" + html2CanvasJavaScript + "\n  </script>");
  const bool imageInjected = ReplaceOnce(
      html, R"(src="assets/forma.png")",
      "src=\"data:image/png;base64," + Base64Encode(formaImage) + "\"");
  const bool appleIconInjected = ReplaceOnce(
      html, R"(href="assets/apple-touch-icon.png")",
      "href=\"data:image/png;base64," +
          Base64Encode(appleTouchIcon) + "\"");
  ReplaceOnce(
      html, R"(  <link rel="manifest" href="manifest.json">)",
      "");

  if (!cssInjected || !scriptInjected || !qrCodeInjected ||
      !html2CanvasInjected || !imageInjected || !appleIconInjected ||
      formaImage.empty() || appleTouchIcon.empty()) {
    MessageBoxW(nullptr,
                L"内嵌网页资源不完整，请重新构建离线版。",
                kWindowTitle, MB_OK | MB_ICONERROR);
    return {};
  }

  return html;
}

std::filesystem::path GetLocalAppDataPath() {
  wchar_t path[MAX_PATH]{};
  if (SUCCEEDED(SHGetFolderPathW(
          nullptr, CSIDL_LOCAL_APPDATA | CSIDL_FLAG_CREATE, nullptr,
          SHGFP_TYPE_CURRENT, path))) {
    return std::filesystem::path(path);
  }

  wchar_t fallbackPath[MAX_PATH]{};
  const DWORD length =
      GetTempPathW(MAX_PATH, fallbackPath);
  if (length > 0 && length < MAX_PATH) {
    return std::filesystem::path(fallbackPath);
  }

  return std::filesystem::current_path();
}

bool WriteUtf8File(const std::filesystem::path& path,
                   const std::string& content) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  if (!output) {
    return false;
  }

  output.write(content.data(), static_cast<std::streamsize>(content.size()));
  return output.good();
}

bool WriteBinaryFile(const std::filesystem::path& path,
                     const std::vector<char>& content) {
  std::ofstream output(path, std::ios::binary | std::ios::trunc);
  if (!output) {
    return false;
  }

  output.write(content.data(), static_cast<std::streamsize>(content.size()));
  return output.good();
}

std::filesystem::path PrepareVirtualHostDirectory() {
  const std::filesystem::path webDirectory =
      GetLocalAppDataPath() / L"CyberDice" / L"Web" / kAssetVersion;
  const std::filesystem::path assetsDirectory = webDirectory / L"assets";
  const std::filesystem::path vendorDirectory = webDirectory / L"vendor";
  std::error_code error;
  std::filesystem::create_directories(assetsDirectory, error);
  if (error) {
    return {};
  }
  std::filesystem::create_directories(vendorDirectory, error);
  if (error) {
    return {};
  }

  const std::string html = LoadResourceString(IDR_INDEX_HTML);
  const std::string css = LoadResourceString(IDR_STYLES_CSS);
  const std::string javaScript = LoadResourceString(IDR_APP_JS);
  const std::string qrCodeJavaScript =
      LoadResourceString(IDR_QRCODE_JS);
  const std::string html2CanvasJavaScript =
      LoadResourceString(IDR_HTML2CANVAS_JS);
  const std::string manifest = LoadResourceString(IDR_MANIFEST_JSON);
  const std::string serviceWorker =
      LoadResourceString(IDR_SERVICE_WORKER_JS);
  const std::vector<char> formaImage = LoadResourceBytes(IDR_FORMA_PNG);
  const std::vector<char> icon192 = LoadResourceBytes(IDR_ICON_192_PNG);
  const std::vector<char> icon512 = LoadResourceBytes(IDR_ICON_512_PNG);
  const std::vector<char> appleTouchIcon =
      LoadResourceBytes(IDR_APPLE_TOUCH_PNG);

  if (html.empty() || css.empty() || javaScript.empty() ||
      qrCodeJavaScript.empty() || html2CanvasJavaScript.empty() ||
      manifest.empty() || serviceWorker.empty() || formaImage.empty() ||
      icon192.empty() || icon512.empty() || appleTouchIcon.empty() ||
      !WriteUtf8File(webDirectory / L"index.html", html) ||
      !WriteUtf8File(webDirectory / L"styles.css", css) ||
      !WriteUtf8File(webDirectory / L"app.js", javaScript) ||
      !WriteUtf8File(webDirectory / L"manifest.json", manifest) ||
      !WriteUtf8File(webDirectory / L"sw.js", serviceWorker) ||
      !WriteUtf8File(vendorDirectory / L"qrcode-generator.js",
                     qrCodeJavaScript) ||
      !WriteUtf8File(vendorDirectory / L"html2canvas.min.js",
                     html2CanvasJavaScript) ||
      !WriteBinaryFile(assetsDirectory / L"forma.png", formaImage) ||
      !WriteBinaryFile(assetsDirectory / L"icon-192.png", icon192) ||
      !WriteBinaryFile(assetsDirectory / L"icon-512.png", icon512) ||
      !WriteBinaryFile(assetsDirectory / L"apple-touch-icon.png",
                       appleTouchIcon)) {
    return {};
  }

  return webDirectory;
}

void OpenBrowserFallback(bool showNotice) {
  if (g_fallbackOpened) {
    return;
  }

  g_fallbackOpened = true;
  const std::filesystem::path outputDirectory =
      GetLocalAppDataPath() / L"CyberDice" / L"Offline";
  std::error_code error;
  std::filesystem::create_directories(outputDirectory, error);

  const std::filesystem::path outputPath =
      outputDirectory / kFallbackPageName;
  if (error || g_composedHtml.empty() ||
      !WriteUtf8File(outputPath, g_composedHtml)) {
    MessageBoxW(nullptr,
                L"无法创建离线页面文件，也无法启动默认浏览器。",
                kWindowTitle, MB_OK | MB_ICONERROR);
    PostMessageW(g_mainWindow, WM_CLOSE, 0, 0);
    return;
  }

  const HINSTANCE result =
      ShellExecuteW(nullptr, L"open", outputPath.c_str(), nullptr, nullptr,
                    SW_SHOWNORMAL);
  if (reinterpret_cast<INT_PTR>(result) <= 32) {
    MessageBoxW(nullptr,
                L"无法启动默认浏览器。请确认系统已安装可用的浏览器。",
                kWindowTitle, MB_OK | MB_ICONERROR);
    PostMessageW(g_mainWindow, WM_CLOSE, 0, 0);
    return;
  }

  if (showNotice) {
    MessageBoxW(
        nullptr,
        L"当前系统未启用 WebView2，已使用默认浏览器打开离线页面。",
        kWindowTitle, MB_OK | MB_ICONINFORMATION);
  }

  PostMessageW(g_mainWindow, WM_CLOSE, 0, 0);
}

void ResizeWebView() {
  if (!g_controller || !g_mainWindow) {
    return;
  }

  RECT bounds{};
  GetClientRect(g_mainWindow, &bounds);
  g_controller->put_Bounds(bounds);
}

bool HasBrowserArgument() {
  int argumentCount = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &argumentCount);
  if (arguments == nullptr) {
    return false;
  }

  bool found = false;
  for (int index = 1; index < argumentCount; ++index) {
    if (_wcsicmp(arguments[index], L"--browser") == 0) {
      found = true;
      break;
    }
  }

  LocalFree(arguments);
  return found;
}

void InitializeWebView(HWND window) {
  const std::filesystem::path userDataDirectory =
      GetLocalAppDataPath() / L"CyberDice" / L"WebView2";
  std::error_code error;
  std::filesystem::create_directories(userDataDirectory, error);

  auto options = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();
  options->put_AdditionalBrowserArguments(
      L"--disable-background-networking --disable-component-update "
      L"--disable-domain-reliability --disable-sync --no-first-run "
      L"--no-default-browser-check --metrics-recording-only");

  const HRESULT createEnvironmentResult =
      CreateCoreWebView2EnvironmentWithOptions(
          nullptr, userDataDirectory.c_str(), options.Get(),
          Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
              [window](HRESULT result,
                       ICoreWebView2Environment* environment) -> HRESULT {
                if (FAILED(result) || environment == nullptr) {
                  OpenBrowserFallback(true);
                  return result;
                }

                return environment->CreateCoreWebView2Controller(
                    window,
                    Callback<
                        ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [window](HRESULT controllerResult,
                                 ICoreWebView2Controller* controller)
                            -> HRESULT {
                          if (FAILED(controllerResult) ||
                              controller == nullptr) {
                            OpenBrowserFallback(true);
                            return controllerResult;
                          }

                          g_controller = controller;
                          if (FAILED(
                                  controller->get_CoreWebView2(&g_webView)) ||
                              !g_webView) {
                            OpenBrowserFallback(true);
                            return E_FAIL;
                          }

                          ComPtr<ICoreWebView2Settings> settings;
                          if (SUCCEEDED(g_webView->get_Settings(&settings)) &&
                              settings) {
                            settings->put_AreDevToolsEnabled(FALSE);
                            settings->put_AreDefaultContextMenusEnabled(FALSE);
                            settings->put_IsStatusBarEnabled(FALSE);
                            settings->put_IsZoomControlEnabled(FALSE);
                          }

                          EventRegistrationToken navigationToken{};
                          g_webView->add_NavigationStarting(
                              Callback<
                                  ICoreWebView2NavigationStartingEventHandler>(
                                  [](ICoreWebView2*,
                                     ICoreWebView2NavigationStartingEventArgs*
                                         arguments) -> HRESULT {
                                    LPWSTR uri = nullptr;
                                    if (FAILED(arguments->get_Uri(&uri)) ||
                                        uri == nullptr) {
                                      return S_OK;
                                    }

                                    const bool allowed =
                                        _wcsnicmp(uri, L"about:", 6) == 0 ||
                                        _wcsnicmp(
                                            uri,
                                            L"https://cyber-dice.local/", 25) ==
                                            0;
                                    if (!allowed) {
                                      arguments->put_Cancel(TRUE);
                                    }

                                    CoTaskMemFree(uri);
                                    return S_OK;
                                  })
                                  .Get(),
                              &navigationToken);

                          EventRegistrationToken newWindowToken{};
                          g_webView->add_NewWindowRequested(
                              Callback<ICoreWebView2NewWindowRequestedEventHandler>(
                                  [](ICoreWebView2*,
                                     ICoreWebView2NewWindowRequestedEventArgs*
                                         arguments) -> HRESULT {
                                    arguments->put_Handled(TRUE);
                                    return S_OK;
                                  })
                                  .Get(),
                              &newWindowToken);

                          ResizeWebView();
                          const std::filesystem::path webDirectory =
                              PrepareVirtualHostDirectory();
                          ComPtr<ICoreWebView2_3> webView3;
                          if (webDirectory.empty() ||
                              FAILED(g_webView.As(&webView3)) ||
                              !webView3 ||
                              FAILED(webView3->SetVirtualHostNameToFolderMapping(
                                  kVirtualHost, webDirectory.c_str(),
                                  COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW))) {
                            OpenBrowserFallback(true);
                            return E_FAIL;
                          }

                          const HRESULT navigateResult =
                              g_webView->Navigate(kVirtualUrl);
                          if (FAILED(navigateResult)) {
                            OpenBrowserFallback(true);
                            return navigateResult;
                          }

                          controller->MoveFocus(
                              COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
                          return S_OK;
                        })
                        .Get());
              })
              .Get());

  if (FAILED(createEnvironmentResult)) {
    OpenBrowserFallback(true);
  }
}

LRESULT CALLBACK WindowProc(HWND window, UINT message, WPARAM wParam,
                            LPARAM lParam) {
  switch (message) {
    case WM_SIZE:
      ResizeWebView();
      return 0;

    case WM_SETFOCUS:
      if (g_controller) {
        g_controller->MoveFocus(
            COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
      }
      return 0;

    case WM_GETMINMAXINFO: {
      auto* info = reinterpret_cast<MINMAXINFO*>(lParam);
      const UINT dpi = GetDpiForWindow(window);
      info->ptMinTrackSize.x = MulDiv(kMinimumClientWidth, dpi, 96);
      info->ptMinTrackSize.y = MulDiv(kMinimumClientHeight, dpi, 96);
      return 0;
    }

    case WM_ERASEBKGND: {
      RECT client{};
      GetClientRect(window, &client);
      FillRect(reinterpret_cast<HDC>(wParam), &client,
               reinterpret_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)));
      return 1;
    }

    case WM_DESTROY:
      g_webView.Reset();
      if (g_controller) {
        g_controller->Close();
        g_controller.Reset();
      }
      PostQuitMessage(0);
      return 0;

    default:
      return DefWindowProcW(window, message, wParam, lParam);
  }
}

RECT GetCenteredWindowRect(int clientWidth, int clientHeight) {
  RECT rect{0, 0, clientWidth, clientHeight};
  AdjustWindowRectEx(&rect, WS_OVERLAPPEDWINDOW, FALSE, 0);

  MONITORINFO monitorInfo{};
  monitorInfo.cbSize = sizeof(monitorInfo);
  GetMonitorInfoW(MonitorFromPoint(POINT{0, 0}, MONITOR_DEFAULTTOPRIMARY),
                  &monitorInfo);

  const RECT workArea = monitorInfo.rcWork;
  const int width = rect.right - rect.left;
  const int height = rect.bottom - rect.top;
  const int left = workArea.left + ((workArea.right - workArea.left) - width) / 2;
  const int top = workArea.top + ((workArea.bottom - workArea.top) - height) / 2;

  return RECT{left, top, left + width, top + height};
}

}  // 匿名命名空间

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  const HRESULT comResult =
      CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  if (FAILED(comResult)) {
    MessageBoxW(nullptr, L"COM 初始化失败，无法启动离线版。",
                kWindowTitle, MB_OK | MB_ICONERROR);
    return 1;
  }

  g_instance = instance;
  g_composedHtml = BuildEmbeddedDocument();
  if (g_composedHtml.empty()) {
    CoUninitialize();
    return 1;
  }

  if (HasBrowserArgument()) {
    OpenBrowserFallback(false);
    CoUninitialize();
    return 0;
  }

  WNDCLASSEXW windowClass{};
  windowClass.cbSize = sizeof(windowClass);
  windowClass.lpfnWndProc = WindowProc;
  windowClass.hInstance = instance;
  windowClass.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(IDI_APP_ICON));
  if (!windowClass.hIcon) {
    windowClass.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
  }
  windowClass.hIconSm = windowClass.hIcon;
  windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  windowClass.hbrBackground =
      reinterpret_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
  windowClass.lpszClassName = kWindowClass;

  if (!RegisterClassExW(&windowClass)) {
    MessageBoxW(nullptr, L"无法注册离线版窗口。", kWindowTitle,
                MB_OK | MB_ICONERROR);
    CoUninitialize();
    return 1;
  }

  const RECT windowRect =
      GetCenteredWindowRect(kDefaultClientWidth, kDefaultClientHeight);
  g_mainWindow = CreateWindowExW(
      0, kWindowClass, kWindowTitle, WS_OVERLAPPEDWINDOW,
      windowRect.left, windowRect.top,
      windowRect.right - windowRect.left,
      windowRect.bottom - windowRect.top, nullptr, nullptr, instance, nullptr);

  if (!g_mainWindow) {
    MessageBoxW(nullptr, L"无法创建离线版窗口。", kWindowTitle,
                MB_OK | MB_ICONERROR);
    CoUninitialize();
    return 1;
  }

  ShowWindow(g_mainWindow, showCommand);
  UpdateWindow(g_mainWindow);
  InitializeWebView(g_mainWindow);

  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }

  CoUninitialize();
  return static_cast<int>(message.wParam);
}
