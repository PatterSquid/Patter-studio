.class public Lnet/pattersquid/patterscript/Files;
.super Landroid/content/ContentProvider;

# hands the shared script or backup file to the app it was shared with (read only, files in cache/share only)

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/content/ContentProvider;-><init>()V
    return-void
.end method

.method public onCreate()Z
    .locals 1
    const/4 v0, 0x1
    return v0
.end method

.method private fileOf(Landroid/net/Uri;)Ljava/io/File;
    .locals 4
    new-instance v0, Ljava/io/File;
    invoke-virtual {p0}, Lnet/pattersquid/patterscript/Files;->getContext()Landroid/content/Context;
    move-result-object v1
    invoke-virtual {v1}, Landroid/content/Context;->getCacheDir()Ljava/io/File;
    move-result-object v1
    const-string v2, "share"
    invoke-direct {v0, v1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    invoke-virtual {p1}, Landroid/net/Uri;->getLastPathSegment()Ljava/lang/String;
    move-result-object v3
    new-instance v1, Ljava/io/File;
    invoke-direct {v1, v0, v3}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    return-object v1
.end method

.method public getType(Landroid/net/Uri;)Ljava/lang/String;
    .locals 2
    invoke-virtual {p1}, Landroid/net/Uri;->getLastPathSegment()Ljava/lang/String;
    move-result-object v0
    const-string v1, ".json"
    invoke-virtual {v0, v1}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :t
    const-string v1, "application/json"
    return-object v1
    :t
    const-string v1, "text/plain"
    return-object v1
.end method

.method public openFile(Landroid/net/Uri;Ljava/lang/String;)Landroid/os/ParcelFileDescriptor;
    .locals 2
    invoke-direct {p0, p1}, Lnet/pattersquid/patterscript/Files;->fileOf(Landroid/net/Uri;)Ljava/io/File;
    move-result-object v0
    const/high16 v1, 0x10000000
    invoke-static {v0, v1}, Landroid/os/ParcelFileDescriptor;->open(Ljava/io/File;I)Landroid/os/ParcelFileDescriptor;
    move-result-object v0
    return-object v0
.end method

.method public query(Landroid/net/Uri;[Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;Ljava/lang/String;)Landroid/database/Cursor;
    .locals 6
    invoke-direct {p0, p1}, Lnet/pattersquid/patterscript/Files;->fileOf(Landroid/net/Uri;)Ljava/io/File;
    move-result-object v0
    const/4 v1, 0x2
    new-array v2, v1, [Ljava/lang/String;
    const/4 v3, 0x0
    const-string v4, "_display_name"
    aput-object v4, v2, v3
    const/4 v3, 0x1
    const-string v4, "_size"
    aput-object v4, v2, v3
    new-instance v5, Landroid/database/MatrixCursor;
    invoke-direct {v5, v2}, Landroid/database/MatrixCursor;-><init>([Ljava/lang/String;)V
    new-array v2, v1, [Ljava/lang/Object;
    const/4 v3, 0x0
    invoke-virtual {v0}, Ljava/io/File;->getName()Ljava/lang/String;
    move-result-object v4
    aput-object v4, v2, v3
    const/4 v3, 0x1
    invoke-virtual {v0}, Ljava/io/File;->length()J
    move-result-wide v0
    invoke-static {v0, v1}, Ljava/lang/Long;->valueOf(J)Ljava/lang/Long;
    move-result-object v4
    aput-object v4, v2, v3
    invoke-virtual {v5, v2}, Landroid/database/MatrixCursor;->addRow([Ljava/lang/Object;)V
    return-object v5
.end method

.method public insert(Landroid/net/Uri;Landroid/content/ContentValues;)Landroid/net/Uri;
    .locals 1
    const/4 v0, 0x0
    return-object v0
.end method

.method public delete(Landroid/net/Uri;Ljava/lang/String;[Ljava/lang/String;)I
    .locals 1
    const/4 v0, 0x0
    return v0
.end method

.method public update(Landroid/net/Uri;Landroid/content/ContentValues;Ljava/lang/String;[Ljava/lang/String;)I
    .locals 1
    const/4 v0, 0x0
    return v0
.end method
