// worker.js - Логика для фонового потока

// ИЗМЕНЕНО: Импортируем локальную копию библиотеки.
try {
  importScripts("heic2any.min.js");
} catch (e) {
  console.error("Не удалось загрузить heic2any.min.js в воркере", e);
  // Отправляем сообщение об ошибке, чтобы основной поток знал о проблеме
  self.postMessage({
    success: false,
    error: "Failed to load converter library.",
  });
}

// Слушаем сообщения от основного потока
self.onmessage = async (event) => {
  // Проверяем, загрузилась ли библиотека
  if (typeof heic2any === "undefined") {
    return; // Выходим, если библиотека не загружена
  }

  const { file, quality } = event.data;

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
