/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * The file tree button's words. Eight locales ship with the package so the
 * rail and the panel it opens read in the same language as the rest of the
 * shell; the keys name where each string appears rather than what it says.
 */
export const zh = {
  'button.label': '文件',
  'panel.label': '工作区文件',
  'panel.loading': '正在读取目录…',
  'panel.empty': '这个工作区还没有文件。',
  'panel.noSession': '先打开一个会话，文件树会显示它的工作区。',
  'menu.refresh': '刷新磁盘',
  'menu.reference': '引用到输入框',
  'error.notFound': '路径不存在。',
  'error.outsideWorkspace': '路径不在这个工作区里。',
  'error.notDirectory': '这不是一个目录。',
  'error.unavailable': '读取失败：{message}',
  'error.truncated': '目录条目过多，只显示了一部分。',
} satisfies Record<string, string>

/** Every key the panel and the rail button translate. */
export type SidebarFilesIdeaKey = keyof typeof zh

/** English copy. */
export const en = {
  'button.label': 'Files',
  'panel.label': 'Workspace files',
  'panel.loading': 'Reading the directory…',
  'panel.empty': 'This workspace has no files yet.',
  'panel.noSession': 'Open a Session and its workspace tree appears here.',
  'menu.refresh': 'Refresh from disk',
  'menu.reference': 'Reference in the composer',
  'error.notFound': 'That path does not exist.',
  'error.outsideWorkspace': 'That path is outside this workspace.',
  'error.notDirectory': 'That is not a directory.',
  'error.unavailable': 'Could not read the directory: {message}',
  'error.truncated': 'The directory has too many entries to list in full.',
} satisfies Record<SidebarFilesIdeaKey, string>

/** Japanese copy. */
export const ja = {
  'button.label': 'ファイル',
  'panel.label': 'ワークスペースのファイル',
  'panel.loading': 'ディレクトリを読み込んでいます…',
  'panel.empty': 'このワークスペースにはまだファイルがありません。',
  'panel.noSession': 'セッションを開くと、そのワークスペースのツリーがここに表示されます。',
  'menu.refresh': 'ディスクから更新',
  'menu.reference': '入力欄に引用',
  'error.notFound': 'そのパスは存在しません。',
  'error.outsideWorkspace': 'そのパスはこのワークスペースの外にあります。',
  'error.notDirectory': 'ディレクトリではありません。',
  'error.unavailable': 'ディレクトリを読み込めませんでした: {message}',
  'error.truncated': 'エントリが多すぎるため、一部のみ表示しています。',
} satisfies Record<SidebarFilesIdeaKey, string>

/** Spanish copy. */
export const es = {
  'button.label': 'Archivos',
  'panel.label': 'Archivos del espacio de trabajo',
  'panel.loading': 'Leyendo el directorio…',
  'panel.empty': 'Este espacio de trabajo aún no tiene archivos.',
  'panel.noSession': 'Abre una sesión y su árbol de archivos aparecerá aquí.',
  'menu.refresh': 'Actualizar desde el disco',
  'menu.reference': 'Citar en el compositor',
  'error.notFound': 'Esa ruta no existe.',
  'error.outsideWorkspace': 'Esa ruta está fuera de este espacio de trabajo.',
  'error.notDirectory': 'Eso no es un directorio.',
  'error.unavailable': 'No se pudo leer el directorio: {message}',
  'error.truncated': 'El directorio tiene demasiadas entradas para listarlas todas.',
} satisfies Record<SidebarFilesIdeaKey, string>

/** French copy. */
export const fr = {
  'button.label': 'Fichiers',
  'panel.label': "Fichiers de l'espace de travail",
  'panel.loading': 'Lecture du dossier…',
  'panel.empty': "Cet espace de travail n'a pas encore de fichiers.",
  'panel.noSession': "Ouvrez une session et son arborescence apparaîtra ici.",
  'menu.refresh': 'Actualiser depuis le disque',
  'menu.reference': 'Citer dans le compositeur',
  'error.notFound': "Ce chemin n'existe pas.",
  'error.outsideWorkspace': 'Ce chemin est en dehors de cet espace de travail.',
  'error.notDirectory': "Ce n'est pas un dossier.",
  'error.unavailable': 'Lecture du dossier impossible : {message}',
  'error.truncated': 'Le dossier contient trop d’entrées pour être listé en entier.',
} satisfies Record<SidebarFilesIdeaKey, string>

/** German copy. */
export const de = {
  'button.label': 'Dateien',
  'panel.label': 'Arbeitsbereichsdateien',
  'panel.loading': 'Verzeichnis wird gelesen…',
  'panel.empty': 'Dieser Arbeitsbereich hat noch keine Dateien.',
  'panel.noSession': 'Öffne eine Sitzung, dann erscheint hier ihr Arbeitsbereichsbaum.',
  'menu.refresh': 'Vom Datenträger neu laden',
  'menu.reference': 'Im Eingabefeld referenzieren',
  'error.notFound': 'Dieser Pfad existiert nicht.',
  'error.outsideWorkspace': 'Dieser Pfad liegt außerhalb dieses Arbeitsbereichs.',
  'error.notDirectory': 'Das ist kein Verzeichnis.',
  'error.unavailable': 'Verzeichnis konnte nicht gelesen werden: {message}',
  'error.truncated': 'Das Verzeichnis hat zu viele Einträge für eine vollständige Liste.',
} satisfies Record<SidebarFilesIdeaKey, string>

/** Russian copy. */
export const ru = {
  'button.label': 'Файлы',
  'panel.label': 'Файлы рабочей области',
  'panel.loading': 'Чтение каталога…',
  'panel.empty': 'В этой рабочей области пока нет файлов.',
  'panel.noSession': 'Откройте сеанс, и здесь появится дерево его рабочей области.',
  'menu.refresh': 'Обновить с диска',
  'menu.reference': 'Сослаться в поле ввода',
  'error.notFound': 'Такого пути нет.',
  'error.outsideWorkspace': 'Этот путь вне данной рабочей области.',
  'error.notDirectory': 'Это не каталог.',
  'error.unavailable': 'Не удалось прочитать каталог: {message}',
  'error.truncated': 'В каталоге слишком много записей для полного списка.',
} satisfies Record<SidebarFilesIdeaKey, string>

/** Portuguese copy. */
export const pt = {
  'button.label': 'Arquivos',
  'panel.label': 'Arquivos do espaço de trabalho',
  'panel.loading': 'Lendo o diretório…',
  'panel.empty': 'Este espaço de trabalho ainda não tem arquivos.',
  'panel.noSession': 'Abra uma sessão e a árvore do espaço de trabalho aparecerá aqui.',
  'menu.refresh': 'Atualizar do disco',
  'menu.reference': 'Citar no compositor',
  'error.notFound': 'Esse caminho não existe.',
  'error.outsideWorkspace': 'Esse caminho está fora deste espaço de trabalho.',
  'error.notDirectory': 'Isso não é um diretório.',
  'error.unavailable': 'Não foi possível ler o diretório: {message}',
  'error.truncated': 'O diretório tem entradas demais para listar por completo.',
} satisfies Record<SidebarFilesIdeaKey, string>