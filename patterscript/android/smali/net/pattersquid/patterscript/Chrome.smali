.class public Lnet/pattersquid/patterscript/Chrome;
.super Landroid/webkit/WebChromeClient;

.field private act:Lnet/pattersquid/patterscript/MainActivity;

.method public constructor <init>(Lnet/pattersquid/patterscript/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lnet/pattersquid/patterscript/Chrome;->act:Lnet/pattersquid/patterscript/MainActivity;
    return-void
.end method

# "Restore from a backup": the phone's file picker
.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 4
    iget-object v0, p0, Lnet/pattersquid/patterscript/Chrome;->act:Lnet/pattersquid/patterscript/MainActivity;
    iget-object v1, v0, Lnet/pattersquid/patterscript/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v1, :none
    const/4 v2, 0x0
    invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :none
    iput-object p2, v0, Lnet/pattersquid/patterscript/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    new-instance v1, Landroid/content/Intent;
    const-string v2, "android.intent.action.GET_CONTENT"
    invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v2, "android.intent.category.OPENABLE"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
    const-string v2, "*/*"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;
    :try_start
    const/4 v2, 0x1
    invoke-virtual {v0, v1, v2}, Lnet/pattersquid/patterscript/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail
    const/4 v2, 0x1
    return v2
    :fail
    const/4 v2, 0x0
    iput-object v2, v0, Lnet/pattersquid/patterscript/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    const/4 v2, 0x0
    return v2
.end method
