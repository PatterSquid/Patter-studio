.class public Lnet/pattersquid/patterscript/Bridge;
.super Ljava/lang/Object;

.field private act:Lnet/pattersquid/patterscript/MainActivity;

.method public constructor <init>(Lnet/pattersquid/patterscript/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lnet/pattersquid/patterscript/Bridge;->act:Lnet/pattersquid/patterscript/MainActivity;
    return-void
.end method

# share(name, text, mime): writes the file into the app's cache and opens the phone's share menu with it
.method public share(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Z
    .locals 7
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation
    :try_start
    iget-object v0, p0, Lnet/pattersquid/patterscript/Bridge;->act:Lnet/pattersquid/patterscript/MainActivity;
    new-instance v1, Ljava/io/File;
    invoke-virtual {v0}, Lnet/pattersquid/patterscript/MainActivity;->getCacheDir()Ljava/io/File;
    move-result-object v2
    const-string v3, "share"
    invoke-direct {v1, v2, v3}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    invoke-virtual {v1}, Ljava/io/File;->mkdirs()Z
    new-instance v2, Ljava/io/File;
    invoke-direct {v2, v1, p1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    new-instance v3, Ljava/io/FileOutputStream;
    invoke-direct {v3, v2}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
    const-string v4, "UTF-8"
    invoke-virtual {p2, v4}, Ljava/lang/String;->getBytes(Ljava/lang/String;)[B
    move-result-object v4
    invoke-virtual {v3, v4}, Ljava/io/FileOutputStream;->write([B)V
    invoke-virtual {v3}, Ljava/io/FileOutputStream;->close()V

    new-instance v3, Ljava/lang/StringBuilder;
    invoke-direct {v3}, Ljava/lang/StringBuilder;-><init>()V
    const-string v4, "content://net.pattersquid.patterscript.files/"
    invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-static {p1}, Landroid/net/Uri;->encode(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v4
    invoke-virtual {v3, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v3
    invoke-static {v3}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;
    move-result-object v3

    new-instance v4, Landroid/content/Intent;
    const-string v5, "android.intent.action.SEND"
    invoke-direct {v4, v5}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    invoke-virtual {v4, p3}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;
    const-string v5, "android.intent.extra.STREAM"
    invoke-virtual {v4, v5, v3}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Landroid/os/Parcelable;)Landroid/content/Intent;
    const-string v5, "android.intent.extra.TITLE"
    invoke-virtual {v4, v5, p1}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;
    const-string v5, ""
    invoke-static {v5, v3}, Landroid/content/ClipData;->newRawUri(Ljava/lang/CharSequence;Landroid/net/Uri;)Landroid/content/ClipData;
    move-result-object v5
    invoke-virtual {v4, v5}, Landroid/content/Intent;->setClipData(Landroid/content/ClipData;)V
    const/4 v5, 0x1
    invoke-virtual {v4, v5}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;

    const/4 v5, 0x0
    invoke-static {v4, v5}, Landroid/content/Intent;->createChooser(Landroid/content/Intent;Ljava/lang/CharSequence;)Landroid/content/Intent;
    move-result-object v4
    const/4 v5, 0x1
    invoke-virtual {v4, v5}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;
    invoke-virtual {v0, v4}, Lnet/pattersquid/patterscript/MainActivity;->startActivity(Landroid/content/Intent;)V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail
    const/4 v6, 0x1
    return v6
    :fail
    const/4 v6, 0x0
    return v6
.end method
