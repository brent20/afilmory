/**
 * Translates the builder's Chinese log messages to English at print time.
 *
 * This only changes the text that is printed to the console / TUI. Nothing
 * that is written to the manifest, thumbnails or storage is affected.
 *
 * How it works:
 *   1. SENTENCE_RULES  - regex rules for messages where the English word order
 *                        differs from the Chinese one (applied first, in order).
 *   2. PHRASES         - plain phrase -> phrase dictionary (longest match wins),
 *                        so interpolated values (file names, counts, ...) are
 *                        preserved untouched.
 *   3. Punctuation     - full-width punctuation is converted to ASCII.
 *
 * Any Chinese text that has no entry is left as-is, so a new untranslated log
 * line simply shows up in Chinese until an entry is added below.
 */

const CJK = /[一-鿿가-힯]/

// ---------------------------------------------------------------------------
// 1. Sentence rules (word order differs between Chinese and English)
// ---------------------------------------------------------------------------
const SENTENCE_RULES: Array<[RegExp, string]> = [
  // Worker / cluster pool
  [/分配 (\d+) 个任务/g, 'Assigned $1 tasks'],
  [/已将 (\d+) 个未完成任务重新入队/g, 'Re-queued $1 unfinished tasks'],
  [
    /计算 worker 数量：总任务 (\d+)，每个 worker 并发 (\d+)，需要 (\d+) 个，实际启动 (\d+) 个/g,
    'Calculated worker count: $1 total tasks, $2 concurrency per worker, $3 needed, $4 actually started',
  ],
  [/Worker (\d+) 完成，处理了 (\d+) 个任务/g, 'Worker $1 finished, processed $2 tasks'],

  // Builder summary
  [/现有 manifest 包含 (\d+) 张照片/g, 'Existing manifest contains $1 photos'],
  [/存储中找到 (\d+) 个文件/g, 'Found $1 files in storage'],
  [/检测到 (\d+) 个 Live Photo/g, 'Detected $1 Live Photos'],
  [/存储中找到 (\d+) 张照片，实际需要处理 (\d+) 张/g, 'Found $1 photos in storage, $2 need processing'],
  [/存储中找到 (\d+) 张照片/g, 'Found $1 photos in storage'],
  [/调试筛选后剩余 (\d+) 张照片/g, '$1 photos remaining after debug filtering'],
  [/包含 (\d+) 个相机，🔍 (\d+) 个镜头/g, 'Contains $1 cameras, 🔍 $2 lenses'],
  [/(\d+)分(\d+)秒/g, '$1m $2s'],
  [/(\d+)秒/g, '$1s'],

  // Plugins
  [/为 (\d+) 张缺失位置信息的照片尝试补全，成功 (\d+) 张/g, 'Tried to fill in location info for $1 photos missing it, $2 succeeded'],
  [/初始化插件 "(.*?)" 失败/g, 'Failed to initialize plugin "$1"'],
  [/插件 "(.*?)" 在 (.*?) 钩子中抛出错误/g, 'Plugin "$1" threw an error in the $2 hook'],

  // Manifest migration
  [
    /照片 (.+?) 的 Live Photo 数据不完整（缺少 s3Key），跳过 video 字段生成/g,
    'Photo $1 has incomplete Live Photo data (missing s3Key), skipping video field generation',
  ],

  // Retries / geocoding
  [/(Mapbox|Nominatim) API 调用失败，(\d+)ms 后重试/g, '$1 API call failed, retrying in $2ms'],
  [/等待 (\d+)ms 后重试/g, 'Waiting $1ms before retrying'],

  // Storage providers
  [/列出目录 (.*?) 失败/g, 'Failed to list directory $1'],
  [/文件数量超过限制 (\d+)，截取前 (\d+) 个文件/g, 'File count exceeds limit of $1, truncating to the first $2 files'],
  [
    /当前支持 Eagle (.*?) 版本的库，检测到的版本为：(.*?)，可能会导致兼容性问题。/g,
    'Currently supports Eagle $1 libraries, detected version: $2, which may cause compatibility issues.',
  ],

  // Stand-alone one-word values (only when not part of a longer Chinese word)
  [/(?<![一-鿿])无(?![一-鿿])/g, 'none'],
  [/(?<![一-鿿])否(?![一-鿿])/g, 'no'],
]

// ---------------------------------------------------------------------------
// 2. Phrase dictionary (longest phrase wins)
// ---------------------------------------------------------------------------
const PHRASES: Array<[string, string]> = [
  // ----- CLI / configuration dump -----
  ['未配置存储提供商，请先在配置文件中设置 storage 字段', 'No storage provider configured, please set the storage field in the config file first'],
  ['未配置用户级存储设置', 'User-level storage settings not configured'],
  ['缺失存储配置，请配置 storage 字段', 'Storage configuration is missing, please configure the storage field'],
  ['当前配置', 'Current configuration'],
  ['存储提供商', 'Storage provider'],
  ['存储桶', 'Bucket'],
  ['区域', 'Region'],
  ['端点', 'Endpoint'],
  ['自定义域名', 'Custom domain'],
  ['前缀', 'Prefix'],
  ['仓库所有者', 'Repo owner'],
  ['仓库名称', 'Repo name'],
  ['分支', 'Branch'],
  ['路径', 'Path'],
  ['使用原始 URL', 'Use raw URL'],
  ['默认并发数', 'Default concurrency'],
  ['Live Photo 检测', 'Live Photo detection'],
  ['照片后缀摘要长度', 'Photo suffix digest length'],
  ['Worker 数', 'Worker count'],
  ['Worker 超时', 'Worker timeout'],
  ['集群模式', 'Cluster mode'],
  ['未设置', 'not set'],
  ['默认 AWS S3', 'default AWS S3'],
  ['默认', 'default'],
  ['无前缀', 'no prefix'],
  ['启用', 'enabled'],
  ['禁用', 'disabled'],
  ['已启用', 'enabled'],
  ['增量更新', 'Incremental update'],
  ['全量更新', 'Full update'],
  ['强制刷新 manifest 和缩略图', 'Force refresh manifest and thumbnails'],
  ['强制刷新 manifest', 'Force refresh manifest'],
  ['强制刷新缩略图', 'Force refresh thumbnails'],
  ['多进程集群', 'Multi-process cluster'],
  ['并发线程池', 'Concurrent thread pool'],
  ['运行模式', 'Run mode'],
  ['最大并发数', 'Max concurrency'],
  ['处理模式', 'Processing mode'],
  ['使用构建器', 'Using builder'],
  ['适配器模式', 'adapter pattern'],
  ['Key 正则筛选', 'Key regex filter'],
  ['构建失败', 'Build failed'],
  ['Perl 已安装', 'Perl is installed'],
  ['Perl 未安装，请安装 Perl 并重新运行', 'Perl is not installed, please install Perl and re-run'],
  ['Worker 未初始化，请先发送 init 消息', 'Worker not initialized, please send the init message first'],

  // ----- Builder -----
  ['构建 manifest 失败', 'Failed to build manifest'],
  ['使用存储提供商', 'Using storage provider'],
  ['没有找到需要处理的照片', 'No photos found to process'],
  ['已按文件大小降序重排处理队列', 'Processing queue re-sorted by file size (largest first)'],
  ['没有需要处理的照片，使用现有 manifest', 'No photos to process, using existing manifest'],
  ['开始多进程处理任务', 'Starting multi-process task processing'],
  ['开始并发处理任务，工作池模式，并发数', 'Starting concurrent task processing, worker pool mode, concurrency'],
  ['开始并发处理任务', 'Starting concurrent task processing'],
  ['进程数', 'process count'],
  ['Worker数', 'Worker count'],
  ['每进程并发', 'per-process concurrency'],
  ['Dry-run 模式：跳过 manifest 保存、缩略图清理和插件副作用', 'Dry-run mode: skipping manifest save, thumbnail cleanup and plugin side effects'],
  ['开始从存储获取照片列表', 'Fetching photo list from storage'],
  ['使用端点', 'Using endpoint'],
  ['Manifest 构建完成', 'Manifest build complete'],
  ['处理统计', 'Processing stats'],
  ['总照片数', 'Total photos'],
  ['新增照片', 'New photos'],
  ['处理照片', 'Processed photos'],
  ['跳过照片', 'Skipped photos'],
  ['删除照片', 'Deleted photos'],
  ['总耗时', 'Total time'],
  ['请配置 system/user 设置。', 'Please configure system/user settings.'],
  ['请配置 system/user storage 设置。', 'Please configure system/user storage settings.'],

  // ----- Worker pool / cluster -----
  ['开始集群模式处理任务', 'Starting cluster-mode task processing'],
  ['总任务数', 'total tasks'],
  ['所有任务完成，开始关闭进程池', 'All tasks complete, shutting down the process pool'],
  ['进程启动', 'process started'],
  ['进程错误', 'process error'],
  ['意外退出', 'exited unexpectedly'],
  ['正常退出', 'exited normally'],
  ['启动超时', 'startup timed out'],
  ['发送初始化数据到', 'Sending init data to'],
  ['已接收初始化请求，等待初始化完成', 'received init request, waiting for initialization to finish'],
  ['已准备就绪', 'is ready'],
  ['初始化完成，可以接受任务', 'initialized, ready to accept tasks'],
  ['收到未知任务结果', 'Received unknown task result'],
  ['任务执行失败', 'Task execution failed'],
  ['完成批量任务', 'Batch completed'],
  ['总完成', 'total completed'],
  ['当前处理中', 'in progress'],
  ['已完成', 'completed'],
  ['成功', 'succeeded'],
  ['开始处理任务', 'Started task'],
  ['完成任务', 'Completed task'],
  ['启动', 'started'],

  // ----- Image / photo processing -----
  ['提取照片信息', 'Extracting photo info'],
  ['使用 EXIF Date 对象作为拍摄时间', 'Using EXIF Date object as capture time'],
  ['照片信息提取完成', 'Photo info extraction complete'],
  ['从路径提取标签', 'Extracted tags from path'],
  ['未知的 DateTimeOriginal 类型', 'Unknown DateTimeOriginal type'],
  ['解析 EXIF DateTimeOriginal 失败', 'Failed to parse EXIF DateTimeOriginal'],
  ['从文件名提取拍摄时间', 'Extracted capture time from filename'],
  ['从文件名提取浏览次数', 'Extracted view count from filename'],
  ['使用 Lightroom 标题', 'Using Lightroom title'],
  ['开始计算图片直方图', 'Calculating image histogram'],
  ['直方图计算完成', 'Histogram calculation complete'],
  ['计算直方图失败', 'Failed to calculate histogram'],
  ['开始分析图片影调', 'Analyzing image tone'],
  ['影调分析完成', 'Tone analysis complete'],
  ['分析影调失败', 'Failed to analyze tone'],
  ['亮度', 'brightness'],
  ['对比度', 'contrast'],
  ['图片元数据不完整', 'Incomplete image metadata'],
  ['检测到需要旋转 90°的图片', 'Detected image needing 90° rotation'],
  ['交换宽高', 'swapping width/height'],
  ['获取图片元数据失败', 'Failed to get image metadata'],
  ['开始 HEIC/HEIF → JPEG 转换', 'Starting HEIC/HEIF → JPEG conversion'],
  ['HEIC/HEIF 转换完成', 'HEIC/HEIF conversion complete'],
  ['HEIC/HEIF 转换失败', 'HEIC/HEIF conversion failed'],
  ['检测到 HEIC/HEIF 格式', 'Detected HEIC/HEIF format'],
  ['开始 BMP → JPEG 转换', 'Starting BMP → JPEG conversion'],
  ['BMP 解码失败', 'BMP decode failed'],
  ['BMP 转换完成', 'BMP conversion complete'],
  ['BMP 转换失败', 'BMP conversion failed'],
  ['开始提取 EXIF 数据, 文件路径', 'Starting EXIF extraction, file path'],
  ['EXIF 数据解析失败', 'EXIF data parsing failed'],
  ['EXIF 数据提取完成', 'EXIF data extraction complete'],
  ['提取 EXIF 数据失败', 'Failed to extract EXIF data'],
  ['复用现有缩略图', 'Reusing existing thumbnail'],
  ['读取现有缩略图失败，重新生成', 'Failed to read existing thumbnail, regenerating'],
  ['复用现有 blurhash', 'Reusing existing blurhash'],
  ['复用现有 EXIF 数据', 'Reusing existing EXIF data'],
  ['复用现有影调分析', 'Reusing existing tone analysis'],
  ['生成缩略图 URL 失败', 'Failed to generate thumbnail URL'],
  ['生成缩略图', 'Generating thumbnail'],
  ['生成完成', 'Generation complete'],
  ['生成失败', 'Generation failed'],
  ['处理失败', 'Processing failed'],
  ['无法获取图片数据', 'Unable to get image data'],
  ['预处理图片失败', 'Failed to preprocess image'],
  ['图片预处理失败', 'Image preprocessing failed'],
  ['转换 BMP 失败', 'Failed to convert BMP'],
  ['Sharp 处理失败', 'Sharp processing failed'],
  [
    '检测到同时存在 Motion Photo (嵌入视频) 和 Live Photo (独立视频文件)',
    'Detected both Motion Photo (embedded video) and Live Photo (separate video file)',
  ],
  ['。这是不允许的，请只保留一种格式。', '. This is not allowed, please keep only one format.'],
  ['处理完成', 'Processing complete'],
  ['处理管道失败', 'Processing pipeline failed'],
  ['处理过程中发生异常', 'Exception during processing'],
  ['跳过处理', 'Skipped'],
  ['新照片', 'New photo'],
  ['更新照片', 'Updating photo'],
  ['检测到 Live Photo', 'Detected Live Photo'],
  ['跳过没有 Key 的对象', 'Skipping object without a Key'],
  ['使用遗留的全局 logger，请尽快迁移到执行上下文模式。', 'Using legacy global logger, please migrate to execution-context mode soon.'],
  ['强制模式', 'force mode'],
  ['文件已更新', 'file updated'],
  ['强制更新清单', 'force manifest update'],
  ['补全 XMP 字段', 'fill in XMP fields'],
  ['强制重新生成缩略图', 'force thumbnail regeneration'],
  ['缩略图缺失', 'thumbnail missing'],
  ['无需处理', 'no processing needed'],

  // ----- Manifest -----
  ['未找到 manifest 文件/解析失败，创建新的 manifest 文件...', 'Manifest file not found / failed to parse, creating a new manifest file...'],
  ['无效的 manifest 版本，创建新的 manifest 文件...', 'Invalid manifest version, creating a new manifest file...'],
  ['Manifest 保存至', 'Manifest saved to'],
  ['检查已删除的图片', 'Checking for deleted images'],
  ['没有图片，清空缩略图', 'No images, clearing thumbnails'],
  ['检测到潜在迁移循环，使用占位升级直接跳转到目标版本', 'Possible migration loop detected, jumping straight to the target version with a placeholder upgrade'],
  ['迁移占位', 'Migration placeholder'],
  ['无匹配步骤，直接提升版本', 'no matching step, bumping version directly'],
  ['执行迁移步骤', 'Running migration step'],
  ['Manifest 版本已更新为', 'Manifest version updated to'],
  ['Manifest 迁移失败（占位实现）', 'Manifest migration failed (placeholder implementation)'],
  ['迁移 v7 -> v8: 将 Live Photo/Motion Photo 字段转换为 VideoSource sum type', 'Migrating v7 -> v8: converting Live Photo/Motion Photo fields to VideoSource sum type'],

  // ----- Geocoding -----
  ['调用 Mapbox API', 'Calling Mapbox API'],
  ['Mapbox API 错误', 'Mapbox API error'],
  ['Mapbox API 未返回结果', 'Mapbox API returned no results'],
  ['Mapbox 反向地理编码失败', 'Mapbox reverse geocoding failed'],
  ['调用 Nominatim API', 'Calling Nominatim API'],
  ['Nominatim API 错误', 'Nominatim API error'],
  ['Nominatim API 返回错误', 'Nominatim API returned an error'],
  ['Nominatim 反向地理编码失败', 'Nominatim reverse geocoding failed'],
  ['成功获取位置', 'Successfully got location'],
  ['解析 GPS 坐标失败', 'Failed to parse GPS coordinates'],
  ['无效의 GPS 坐标', 'Invalid GPS coordinates'],
  ['反向地理编码坐标', 'Reverse geocoding coordinates'],
  ['位置已找到', 'Location found'],
  ['未找到位置信息', 'Location info not found'],
  ['位置提取失败', 'Location extraction failed'],
  ['无法创建地理编码提供者，请检查 geocoding 配置和 Token', 'Unable to create geocoding provider, please check the geocoding config and token'],

  // ----- GitHub repo sync plugin -----
  ['githubRepoSyncPlugin 需要 repo 配置', 'githubRepoSyncPlugin requires repo config'],
  ['未配置远程仓库地址，跳过同步', 'Remote repository URL not configured, skipping sync'],
  ['同步远程仓库', 'Syncing remote repository'],
  ['克隆远程仓库', 'Cloning remote repository'],
  ['拉取远程仓库更新', 'Pulling remote repository updates'],
  ['git pull 失败，尝试重新克隆远程仓库', 'git pull failed, trying to re-clone remote repository'],
  ['删除现有仓库目录', 'Deleting existing repository directory'],
  ['重新克隆远程仓库', 'Re-cloning remote repository'],
  ['远程仓库同步完成', 'Remote repository sync complete'],
  ['未找到仓库目录，跳过推送', 'Repository directory not found, skipping push'],
  ['没有更新需要推送到远程仓库', 'No updates to push to remote repository'],
  ['创建 thumbnails 目录', 'Creating thumbnails directory'],
  ['创建初始 manifest 文件', 'Creating initial manifest file'],
  ['未提供 Git Token，跳过推送到远程仓库', 'Git token not provided, skipping push to remote repository'],
  ['开始推送更新到远程仓库', 'Starting push of updates to remote repository'],
  ['没有变更需要推送', 'No changes to push'],
  ['检测到以下变更', 'Detected the following changes'],
  ['成功推送更新到远程仓库', 'Successfully pushed updates to remote repository'],
  ['切换到分支', 'Switching to branch'],
  ['检出远程分支', 'Checking out remote branch'],
  ['创建新分支', 'Creating new branch'],
  ['缩略图上传插件不支持 Eagle 存储提供商，已自动禁用。', 'Thumbnail upload plugin does not support the Eagle storage provider, automatically disabled.'],
  ['上传缩略图失败', 'Failed to upload thumbnail'],

  // ----- Storage: shared -----
  ['不能为空', 'cannot be empty'],
  ['必须大于 0', 'must be greater than 0'],
  ['无效的 excludeRegex', 'invalid excludeRegex'],
  ['不是有效的正则表达式', 'is not a valid regular expression'],
  ['下载文件失败', 'Failed to download file'],
  ['下载文件', 'Downloading file'],
  ['下载开始', 'Download started'],
  ['下载完成', 'Download complete'],
  ['下载最终失败', 'Download ultimately failed'],
  ['下载失败', 'Download failed'],
  ['文件不存在', 'File does not exist'],
  ['源文件不存在', 'source file does not exist'],
  ['无法解析源文件', 'unable to resolve source file'],
  ['无法解析目标文件', 'unable to resolve target file'],
  ['上传成功但无法转换为存储对象', 'Upload succeeded but could not be converted to a storage object'],
  ['响应为空', 'empty response'],

  // ----- Storage: B2 -----
  ['B2 API 请求失败', 'B2 API request failed'],
  ['授权响应缺少 apiUrl/downloadUrl, 请检查凭证或 API 版本', 'authorization response is missing apiUrl/downloadUrl, please check credentials or API version'],
  ['无法解析 bucketName，请在配置中显式提供', 'unable to resolve bucketName, please provide it explicitly in the config'],
  ['B2 move 失败', 'B2 move failed'],

  // ----- Storage: Eagle -----
  ['必须是绝对路径', 'must be an absolute path'],
  ['不是有效的 Eagle 库', 'is not a valid Eagle library'],
  ['已创建 distPath 目录', 'Created distPath directory'],
  ['请求的文件路径不安全', 'requested file path is unsafe'],
  ['不支持的图片格式', 'unsupported image format'],
  ['读取图片文件失败', 'failed to read image file'],
  ['当前不支持删除文件操作', 'deleting files is not currently supported'],
  ['当前不支持删除目录操作', 'deleting directories is not currently supported'],
  ['当前不支持上传文件操作', 'uploading files is not currently supported'],
  ['当前不支持移动文件操作', 'moving files is not currently supported'],
  ['发布目录已存在文件，跳过复制', 'file already exists in publish directory, skipping copy'],
  ['已复制文件到发布目录', 'copied file to publish directory'],
  ['无法找到文件夹索引，跳过该文件夹过滤条件', 'folder index not found, skipping this folder filter'],
  ['指定的 libraryPath 不是目录', 'specified libraryPath is not a directory'],
  ['无法访问指定的 libraryPath', 'unable to access specified libraryPath'],
  ['library metadata.json 不存在', 'library metadata.json does not exist'],
  ['images 不是目录', 'images is not a directory'],
  ['无法访问指定的 images 目录', 'unable to access specified images directory'],
  ['无法解析 library metadata', 'unable to parse library metadata'],
  ['检测到 Eagle 版本', 'Detected Eagle version'],
  ['格式', 'format'],
  ['错误', 'error'],

  // ----- Storage: GitHub -----
  ['GitHub 配置不能为空', 'GitHub config cannot be empty'],
  ['GitHub owner 和 repo 配置不能为空', 'GitHub owner and repo config cannot be empty'],
  ['GitHub API 请求失败', 'GitHub API request failed'],
  ['路径不是文件', 'Path is not a file'],
  ['无法获取文件内容', 'Unable to get file content'],
  ['GitHub 删除文件失败', 'GitHub delete file failed'],
  ['GitHub 上传文件失败', 'GitHub upload file failed'],
  ['GitHub move failed：源文件不存在', 'GitHub move failed: source file does not exist'],

  // ----- Storage: local -----
  ['读取本地文件', 'Reading local file'],
  ['读取完成', 'Read complete'],
  ['读取文件失败', 'Failed to read file'],
  ['文件路径不安全', 'file path is unsafe'],
  ['删除 dist 文件失败', 'Failed to delete dist file'],
  ['删除 dist 目录失败', 'Failed to delete dist directory'],
  ['已删除本地文件', 'Deleted local file'],
  ['删除本地文件失败', 'Failed to delete local file'],
  ['已删除本地目录', 'Deleted local directory'],
  ['删除本地目录失败', 'Failed to delete local directory'],
  ['上传本地文件失败', 'Failed to upload local file'],
  ['重命名本地文件失败', 'Failed to rename local file'],
  ['获取文件信息失败', 'Failed to get file info'],
  ['扫描目录失败', 'Failed to scan directory'],
  ['创建本地存储目录失败', 'Failed to create local storage directory'],
  ['创建本地存储目录', 'Creating local storage directory'],

  // ----- Storage: S3 -----
  ['复制 S3 对象失败', 'Failed to copy S3 object'],
  ['删除源对象失败', 'Failed to delete source object'],
  ['S3 响应异常', 'S3 response error'],
  ['列出 S3 对象失败', 'Failed to list S3 objects'],
  ['删除 S3 对象失败', 'Failed to delete S3 object'],
  ['上传 S3 对象失败', 'Failed to upload S3 object'],
  ['S3 move failed：源文件不存在', 'S3 move failed: source file does not exist'],
]

// Longest phrase first, so e.g. '下载文件失败' wins over '下载文件'.
const PHRASE_MAP = new Map(PHRASES)
const PHRASE_REGEX = new RegExp(
  [...PHRASE_MAP.keys()]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replaceAll(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`))
    .join('|'),
  'g',
)

// ---------------------------------------------------------------------------
// 3. Public API
// ---------------------------------------------------------------------------

/** Translate a single string. Strings without Chinese are returned untouched. */
export function translateLogText(text: string): string {
  if (!CJK.test(text)) return text

  let result = text
  for (const [pattern, replacement] of SENTENCE_RULES) {
    result = result.replace(pattern, replacement)
  }

  result = result.replace(PHRASE_REGEX, (match) => PHRASE_MAP.get(match) ?? match)

  return result
    .replaceAll(/\s*：\s*/g, ': ')
    .replaceAll(/\s*，\s*/g, ', ')
    .replaceAll(/\s*、\s*/g, ', ')
    .replaceAll(/\s*（\s*/g, ' (')
    .replaceAll('）', ')')
    .replaceAll('。', '.')
    .replace(/:\s+$/, ':')
}

function translateError(error: Error): Error {
  const stack = error.stack ?? ''
  if (!CJK.test(error.message) && !CJK.test(stack)) return error

  // Clone so the original error object (which may be re-thrown) is never mutated.
  const clone = Object.create(Object.getPrototypeOf(error)) as Error
  Object.defineProperties(clone, Object.getOwnPropertyDescriptors(error))
  Object.defineProperty(clone, 'message', {
    value: translateLogText(error.message),
    writable: true,
    configurable: true,
  })
  if (stack) {
    Object.defineProperty(clone, 'stack', {
      value: translateLogText(stack),
      writable: true,
      configurable: true,
    })
  }
  return clone
}

/** Translate every string / Error in a logger call's argument list. */
export function translateLogArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') return translateLogText(arg)
    if (arg instanceof Error) return translateError(arg)
    return arg
  })
}
