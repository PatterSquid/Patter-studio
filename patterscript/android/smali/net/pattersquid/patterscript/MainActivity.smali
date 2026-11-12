.class public Lnet/pattersquid/patterscript/MainActivity;
.super Landroid/app/Activity;

.field public web:Landroid/webkit/WebView;
.field public fileCb:Landroid/webkit/ValueCallback;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 5
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    const v0, -0xf0e5d2
    invoke-virtual {p0}, Lnet/pattersquid/patterscript/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v1
    invoke-virtual {v1, v0}, Landroid/view/Window;->setStatusBarColor(I)V
    invoke-virtual {v1, v0}, Landroid/view/Window;->setNavigationBarColor(I)V

    new-instance v2, Landroid/webkit/WebView;
    invoke-direct {v2, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v2, p0, Lnet/pattersquid/patterscript/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v2, v0}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    invoke-virtual {v2}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v3
    const/4 v4, 0x1
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    const/4 v4, 0x0
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setSupportZoom(Z)V
    const/4 v4, 0x1
    invoke-virtual {v3, v4}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    new-instance v3, Lnet/pattersquid/patterscript/Client;
    invoke-direct {v3, p0}, Lnet/pattersquid/patterscript/Client;-><init>(Lnet/pattersquid/patterscript/MainActivity;)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v3, Lnet/pattersquid/patterscript/Chrome;
    invoke-direct {v3, p0}, Lnet/pattersquid/patterscript/Chrome;-><init>(Lnet/pattersquid/patterscript/MainActivity;)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    new-instance v3, Lnet/pattersquid/patterscript/Bridge;
    invoke-direct {v3, p0}, Lnet/pattersquid/patterscript/Bridge;-><init>(Lnet/pattersquid/patterscript/MainActivity;)V
    const-string v4, "PatterAndroid"
    invoke-virtual {v2, v3, v4}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    invoke-virtual {p0, v2}, Lnet/pattersquid/patterscript/MainActivity;->setContentView(Landroid/view/View;)V

    if-eqz p1, :fresh
    invoke-virtual {v2, p1}, Landroid/webkit/WebView;->restoreState(Landroid/os/Bundle;)Landroid/webkit/WebBackForwardList;
    move-result-object v3
    if-nez v3, :done
    :fresh
    const-string v3, "https://appassets.androidplatform.net/index.html"
    invoke-virtual {v2, v3}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    :done
    return-void
.end method

.method protected onSaveInstanceState(Landroid/os/Bundle;)V
    .locals 1
    invoke-super {p0, p1}, Landroid/app/Activity;->onSaveInstanceState(Landroid/os/Bundle;)V
    iget-object v0, p0, Lnet/pattersquid/patterscript/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :n
    invoke-virtual {v0, p1}, Landroid/webkit/WebView;->saveState(Landroid/os/Bundle;)Landroid/webkit/WebBackForwardList;
    :n
    return-void
.end method

.method public onBackPressed()V
    .locals 2
    iget-object v0, p0, Lnet/pattersquid/patterscript/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :up
    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v1
    if-eqz v1, :up
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void
    :up
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 2
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    iget-object v0, p0, Lnet/pattersquid/patterscript/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v0, :n
    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    const/4 v1, 0x0
    iput-object v1, p0, Lnet/pattersquid/patterscript/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    :n
    return-void
.end method
