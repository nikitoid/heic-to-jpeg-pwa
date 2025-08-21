// worker.js - Логика для фонового потока

// --- ИЗМЕНЕНО: Более надежная загрузка библиотеки ---
let libraryLoaded = false;
try {
  // Импортируем локальную копию библиотеки.
  importScripts("heic2any.min.js");
  libraryLoaded = true;
} catch (e) {
  console.error(
    "КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить heic2any.min.js в воркере.",
    e
  );
}

// Слушаем сообщения от основного потока
self.onmessage = async (event) => {
  const { file, quality } = event.data;

  // Если библиотека не загрузилась, немедленно отправляем ошибку обратно
  if (!libraryLoaded) {
    self.postMessage({
      success: false,
      filename: file.name,
      error: "Библиотека для конвертации не загружена.",
    });
    return;
  }

  try {
    // Выполняем тяжелую операцию конвертации
    const conversionResult = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: quality,
    });

    // Формируем объект с результатом
    const result = {
      success: true,
      originalFile: {
        name: file.name,
        size: file.size,
      },
      convertedBlob: conversionResult,
      convertedSize: conversionResult.size,
      filename: file.name.replace(/\.(heic|heif)$/i, ".jpg"),
    };

    // Отправляем результат обратно в основной поток
    self.postMessage(result);
  } catch (error) {
    console.error("Ошибка конвертации в воркере:", file.name, error);
    // В случае ошибки отправляем сообщение об этом
    self.postMessage({
      success: false,
      filename: file.name,
      error: error.message,
    });
  }
};
