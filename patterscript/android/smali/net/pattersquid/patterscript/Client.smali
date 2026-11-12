.class public Lnet/pattersquid/patterscript/Client;
.super Landroid/webkit/WebViewClient;

.field private act:Lnet/pattersquid/patterscript/MainActivity;

.method public constructor <init>(Lnet/pattersquid/patterscript/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
    iput-object p1, p0, Lnet/pattersquid/patterscript/Client;->act:Lnet/pattersquid/patterscript/MainActivity;
    return-void
.end method

# serve the app's own files from the APK at https://appassets.androidplatform.net/ (a fixed https address, so its
# storage is kept like any website's)
.method public shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
    .locals 6
    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
    move-result-object v0
    invoke-virtual {v0}, Landroid/net/Uri;->getHost()Ljava/lang/String;
    move-result-object v1
    const-string v2, "appassets.androidplatform.net"
    invoke-virtual {v2, v1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :ours
    const/4 v0, 0x0
    return-object v0
    :ours
    invoke-virtual {v0}, Landroid/net/Uri;->getPath()Ljava/lang/String;
    move-result-object v1
    if-nez v1, :p
    const-string v1, "/"
    :p
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Ljava/lang/String;->substring(I)Ljava/lang/String;
    move-result-object v1
    invoke-virtual {v1}, Ljava/lang/String;->isEmpty()Z
    move-result v2
    if-eqz v2, :named
    const-string v1, "index.html"
    :named
    const-string v3, "text/html"
    const-string v2, ".js"
    invoke-virtual {v1, v2}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v2
    if-eqz v2, :notjs
    const-string v3, "application/javascript"
    :notjs
    const-string v2, ".png"
    invoke-virtual {v1, v2}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v2
    if-eqz v2, :notpng
    const-string v3, "image/png"
    :notpng
    const-string v2, ".webmanifest"
    invoke-virtual {v1, v2}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v2
    if-eqz v2, :notman
    const-string v3, "application/manifest+json"
    :notman
    :try_start
    iget-object v2, p0, Lnet/pattersquid/patterscript/Client;->act:Lnet/pattersquid/patterscript/MainActivity;
    invoke-virtual {v2}, Lnet/pattersquid/patterscript/MainActivity;->getAssets()Landroid/content/res/AssetManager;
    move-result-object v2
    invoke-virtual {v2, v1}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;
    move-result-object v4
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :missing
    new-instance v5, Landroid/webkit/WebResourceResponse;
    const-string v2, "utf-8"
    invoke-direct {v5, v3, v2, v4}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
    return-object v5
    :missing
    new-instance v5, Landroid/webkit/WebResourceResponse;
    const-string v2, "text/plain"
    const-string v3, "utf-8"
    const/4 v4, 0x0
    invoke-direct {v5, v2, v3, v4}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
    const/16 v2, 0x194
    const-string v3, "Not found"
    invoke-virtual {v5, v2, v3}, Landroid/webkit/WebResourceResponse;->setStatusCodeAndReasonPhrase(ILjava/lang/String;)V
    return-object v5
.end method
