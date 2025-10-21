document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const qualitySlider = document.getElementById("quality-slider");
  const qualityValue = document.getElementById("quality-value");
  const progressIndicator = document.getElementById("progress-indicator");
  const resultsGrid = document.getElementById("results-grid");
  const downloadAllButton = document.getElementById("download-all");
  const uploadButton = document.querySelector(".upload-button");

  // Theme switcher
  const themeToggleButton = document.getElementById("theme-toggle");

  // Settings elements
  const settingsButton = document.getElementById("settings-btn");
  const settingsScreen = document.getElementById("settings-screen");
  const closeSettingsButton = document.getElementById("close-settings-btn");
  const saveSettingsButton = document.getElementById("save-settings-button");
  const defaultQualitySlider = document.getElementById(
    "default-quality-slider"
  );
  const defaultQualityValue = document.getElementById("default-quality-value");
  const saveModeRadios = document.querySelectorAll('input[name="save-mode"]');
  const formatRadios = document.querySelectorAll('input[name="output-format"]');
  const qualitySettingItem = document.querySelector(
    ".setting-item.range-slider"
  );
  const directSaveRadio = document.querySelector('input[value="direct"]');
  const directoryPickerContainer = document.getElementById(
    "directory-picker-container"
  );
  const selectDirBtn = document.getElementById("select-dir-btn");
  const dirPath = document.getElementById("dir-path");
  const dirPickerInput = document.getElementById("dir-picker-input");

  // Lightbox elements
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxFilename = document.getElementById("lightbox-filename");
  const lightboxActionBtn = document.getElementById("lightbox-action-btn");
  const lightboxClose = document.querySelector(".lightbox-close");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const lightboxFileInfo = document.getElementById("lightbox-file-info");

  let directoryHandle = null;
  let convertedFiles = new Map();
  let originalFiles = new Map(); // Для хранения исходных файлов
  let currentImageIndex = 0;
  let galleryFileNames = [];

  // --- Settings Logic ---

  function showSettings() {
    settingsScreen.style.display = "flex";
  }

  function hideSettings() {
    settingsScreen.style.display = "none";
  }

  function saveSettings() {
    const defaultQuality = defaultQualitySlider.value;
    const saveMode = document.querySelector(
      'input[name="save-mode"]:checked'
    ).value;
    const outputFormat = document.querySelector(
      'input[name="output-format"]:checked'
    ).value;

    localStorage.setItem("defaultQuality", defaultQuality);
    localStorage.setItem("saveMode", saveMode);
    localStorage.setItem("outputFormat", outputFormat);

    if (saveMode === "browser") {
      idbKeyval.del("directoryHandle");
      directoryHandle = null;
      dirPath.textContent = "Папка не выбрана";
    }

    // Update main screen slider
    qualitySlider.value = defaultQuality;
    qualityValue.textContent = defaultQuality;

    updateButtonLabels();
    hideSettings();
  }

  function updateSaveModeUI() {
    const saveMode = document.querySelector(
      'input[name="save-mode"]:checked'
    ).value;
    if (saveMode === "direct") {
      directoryPickerContainer.classList.remove("hidden");
    } else {
      directoryPickerContainer.classList.add("hidden");
    }
    updateButtonLabels();
  }

  function updateFormatUI() {
    const outputFormat = document.querySelector(
      'input[name="output-format"]:checked'
    ).value;
    const isPng = outputFormat === "png";
    qualitySettingItem.style.opacity = isPng ? "0.5" : "1";
    defaultQualitySlider.disabled = isPng;
    qualitySlider.disabled = isPng;
    document.querySelector('label[for="quality-slider"]').style.opacity = isPng
      ? "0.5"
      : "1";
  }

  async function loadSettings() {
    const defaultQuality = localStorage.getItem("defaultQuality") || "90";
    const saveMode = localStorage.getItem("saveMode") || "browser";
    const outputFormat = localStorage.getItem("outputFormat") || "jpeg";

    // Update settings modal
    defaultQualitySlider.value = defaultQuality;
    defaultQualityValue.textContent = `${defaultQuality}%`;
    document.querySelector(`input[value="${outputFormat}"]`).checked = true;

    // Update main screen slider
    qualitySlider.value = defaultQuality;
    qualityValue.textContent = defaultQuality;

    document.querySelector(`input[value="${saveMode}"]`).checked = true;

    if (!("showDirectoryPicker" in window)) {
      directSaveRadio.disabled = true;
      directSaveRadio.parentElement.title =
        "Ваш браузер не поддерживает эту функцию.";
    } else {
      // Try to load directory handle from IndexedDB
      try {
        const handle = await idbKeyval.get("directoryHandle");
        if (handle) {
          const permissionState = await handle.queryPermission({
            mode: "readwrite",
          });
          if (permissionState === "granted") {
            directoryHandle = handle;
            dirPath.textContent = directoryHandle.name;
          } else {
            // If permission is not 'granted', we might need to prompt the user again.
            // For now, we'll just clear the handle.
            idbKeyval.del("directoryHandle");
          }
        }
      } catch (error) {
        console.error("Error loading directory handle from IndexedDB:", error);
      }
    }

    updateSaveModeUI();
    updateFormatUI();
  }

  // --- Button Labels ---

  function updateButtonLabels() {
    const saveMode = document.querySelector(
      'input[name="save-mode"]:checked'
    ).value;
    const isDirect = saveMode === "direct";

    downloadAllButton.textContent = isDirect ? "Сохранить все" : "Скачать все";
    lightboxActionBtn.textContent = isDirect ? "Сохранить" : "Скачать";

    document.querySelectorAll(".download-button").forEach((btn) => {
      btn.textContent = isDirect ? "Сохранить" : "Скачать";
    });
  }

  // --- Core Logic ---

  fileInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files);
    const heicFiles = files.filter(
      (file) =>
        file.type === "image/heic" ||
        file.type === "image/heif" ||
        /\.heic$/i.test(file.name) ||
        /\.heif$/i.test(file.name)
    );

    if (heicFiles.length === 0) {
      alert("Пожалуйста, выберите файлы в формате HEIC или HEIF.");
      fileInput.value = "";
      return;
    }

    fileInput.disabled = true;
    uploadButton.classList.add("disabled");
    downloadAllButton.disabled = true;
    resultsGrid.innerHTML = "";
    convertedFiles.clear();
    let convertedCount = 0;

    for (const file of heicFiles) {
      convertedCount++;
      progressIndicator.textContent = `Обработывается ${convertedCount} из ${heicFiles.length}...`;
      const originalFileName = file.name;
      const outputFormat = localStorage.getItem("outputFormat") || "jpeg";
      const newFileExtension = `.${outputFormat}`;
      const newFileName = originalFileName.replace(
        /\.heic(f?)$/i,
        newFileExtension
      );

      try {
        const options = {
          blob: file,
          toType: `image/${outputFormat}`,
        };

        if (outputFormat === "jpeg") {
          options.quality = qualitySlider.value / 100;
        }

        const conversionResult = await heic2any(options);

        const imageUrl = URL.createObjectURL(conversionResult);
        convertedFiles.set(newFileName, {
          blob: conversionResult,
          imageUrl: imageUrl,
          originalSize: file.size,
        });

        const resultItem = document.createElement("div");
        resultItem.classList.add("result-item");
        resultItem.dataset.fileName = newFileName;

        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = newFileName;
        img.onload = () => {
          const infoNode = resultItem.querySelector(".info p");
          if (infoNode) {
            const originalSize = (file.size / 1024 / 1024).toFixed(2);
            const newSize = (conversionResult.size / 1024).toFixed(2);
            infoNode.textContent = `${img.naturalWidth}x${img.naturalHeight} (${newSize}KB)`;
          }
        };

        const infoDiv = document.createElement("div");
        infoDiv.classList.add("info");
        const infoP = document.createElement("p");
        infoP.textContent = "Загрузка...";
        const downloadButton = document.createElement("button");
        downloadButton.classList.add("download-button");
        downloadButton.addEventListener("click", (e) => {
          e.stopPropagation();
          downloadFile(conversionResult, newFileName, imageUrl);
        });

        infoDiv.appendChild(infoP);
        infoDiv.appendChild(downloadButton);
        resultItem.appendChild(img);
        resultItem.appendChild(infoDiv);
        resultsGrid.appendChild(resultItem);
      } catch (error) {
        console.error("Ошибка конвертации файла:", originalFileName, error);
        const errorItem = document.createElement("div");
        errorItem.classList.add("result-item", "error");
        errorItem.textContent = `Ошибка: ${originalFileName}`;
        resultsGrid.appendChild(errorItem);
      }
    }

    if (convertedFiles.size > 0) {
      downloadAllButton.disabled = false;
    }

    progressIndicator.textContent = "Конвертация завершена!";
    setTimeout(() => {
      progressIndicator.textContent = "";
    }, 3000);

    updateButtonLabels();
    fileInput.disabled = false;
    uploadButton.classList.remove("disabled");
    fileInput.value = "";
  });

  async function downloadFile(blob, fileName, imageUrl) {
    const saveMode = document.querySelector(
      'input[name="save-mode"]:checked'
    ).value;

    if (saveMode === "direct" && "showDirectoryPicker" in window) {
      try {
        if (!directoryHandle) {
          alert("Пожалуйста, выберите директорию для сохранения в настройках.");
          showSettings();
          return;
        }
        const fileHandle = await directoryHandle.getFileHandle(fileName, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Не удалось сохранить файл напрямую:", error);
          alert("Не удалось сохранить файл. Файл будет скачан через браузер.");
          downloadViaBrowser(imageUrl, fileName);
        }
      }
    } else {
      downloadViaBrowser(imageUrl, fileName);
    }
  }

  function downloadViaBrowser(imageUrl, fileName) {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadAllButton.addEventListener("click", async () => {
    const saveMode = document.querySelector(
      'input[name="save-mode"]:checked'
    ).value;
    const isDirect = saveMode === "direct" && "showDirectoryPicker" in window;

    if (isDirect && !directoryHandle) {
      alert("Пожалуйста, выберите директорию для сохранения в настройках.");
      showSettings();
      return;
    }

    const downloadPromises = [];
    for (const [fileName, fileData] of convertedFiles.entries()) {
      if (isDirect) {
        downloadPromises.push(
          downloadFile(fileData.blob, fileName, fileData.imageUrl)
        );
      } else {
        downloadViaBrowser(fileData.imageUrl, fileName);
      }
    }
    if (downloadPromises.length > 0) {
      await Promise.all(downloadPromises);
      // Optional: show a "all saved" notification
    }
  });

  // --- Lightbox Logic ---

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  function updateLightboxContent(fileName) {
    const fileData = convertedFiles.get(fileName);
    if (!fileData) return;

    const updateImage = () => {
      lightboxImg.src = fileData.imageUrl;
      // Обновляем информацию о размере файла
      const originalSize = fileData.originalSize;
      const newSize = fileData.blob.size;
      const percentage = ((1 - newSize / originalSize) * 100).toFixed(0);
      lightboxFileInfo.textContent = `Исходный: ${formatBytes(
        originalSize
      )} → Новый: ${formatBytes(newSize)} (-${percentage}%)`;

      // Обновляем инфо о разрешении (если нужно)
      lightboxFilename.textContent = fileName;

      lightboxActionBtn.onclick = () => {
        downloadFile(fileData.blob, fileName, fileData.imageUrl);
      };

      // Обновляем состояние кнопок навигации
      currentImageIndex = galleryFileNames.indexOf(fileName);
      prevBtn.classList.toggle("hidden", currentImageIndex === 0);
      nextBtn.classList.toggle(
        "hidden",
        currentImageIndex === galleryFileNames.length - 1
      );

      lightboxImg.style.opacity = 1;
    };

    if (lightboxImg.src && lightbox.style.display === "flex") {
      lightboxImg.style.opacity = 0;
      setTimeout(updateImage, 300); // Должно совпадать с transition в CSS
    } else {
      updateImage();
    }
  }

  function showNextImage() {
    if (currentImageIndex < galleryFileNames.length - 1) {
      const nextIndex = currentImageIndex + 1;
      updateLightboxContent(galleryFileNames[nextIndex]);
    }
  }

  function showPrevImage() {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      updateLightboxContent(galleryFileNames[prevIndex]);
    }
  }

  resultsGrid.addEventListener("click", (e) => {
    const resultItem = e.target.closest(".result-item");
    if (!resultItem || resultItem.classList.contains("error")) return;

    galleryFileNames = Array.from(
      resultsGrid.querySelectorAll(".result-item:not(.error)")
    ).map((item) => item.dataset.fileName);
    const fileName = resultItem.dataset.fileName;

    updateLightboxContent(fileName);
    lightbox.style.display = "flex";
  });

  function closeLightbox() {
    lightbox.style.display = "none";
    lightboxImg.src = ""; // Освобождаем память
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  prevBtn.addEventListener("click", showPrevImage);
  nextBtn.addEventListener("click", showNextImage);

  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display !== "flex") return;
    if (e.key === "ArrowLeft") {
      showPrevImage();
    } else if (e.key === "ArrowRight") {
      showNextImage();
    } else if (e.key === "Escape") {
      closeLightbox();
    }
  });

  // --- Swipe Logic for Lightbox ---
  let touchstartX = 0;
  let touchendX = 0;

  lightbox.addEventListener(
    "touchstart",
    (e) => {
      touchstartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  lightbox.addEventListener(
    "touchend",
    (e) => {
      touchendX = e.changedTouches[0].screenX;
      handleSwipe();
    },
    { passive: true }
  );

  function handleSwipe() {
    const swipeThreshold = 50; // минимальная дистанция свайпа
    if (touchendX < touchstartX - swipeThreshold) {
      showNextImage();
    }
    if (touchendX > touchstartX + swipeThreshold) {
      showPrevImage();
    }
  }

  // --- Initial Load & Event Listeners ---

  settingsButton.addEventListener("click", (e) => {
    e.preventDefault();
    showSettings();
  });

  closeSettingsButton.addEventListener("click", hideSettings);
  saveSettingsButton.addEventListener("click", saveSettings);

  saveModeRadios.forEach((radio) =>
    radio.addEventListener("change", updateSaveModeUI)
  );

  formatRadios.forEach((radio) =>
    radio.addEventListener("change", updateFormatUI)
  );

  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = qualitySlider.value;
  });

  defaultQualitySlider.addEventListener("input", () => {
    defaultQualityValue.textContent = `${defaultQualitySlider.value}%`;
  });

  async function selectDirectory() {
    try {
      const handle = await window.showDirectoryPicker();
      // Save the handle to IndexedDB
      await idbKeyval.set("directoryHandle", handle);
      directoryHandle = handle;
      dirPath.textContent = directoryHandle.name;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Ошибка при выборе директории:", error);
        alert("Не удалось получить доступ к директории.");
      }
    }
  }

  selectDirBtn.addEventListener("click", selectDirectory);
  dirPickerInput.addEventListener("click", (e) => {
    // Prevent button click from triggering twice
    if (e.target.id !== "select-dir-btn") {
      selectDirectory();
    }
  });

  // --- Theme Switcher Logic ---
  const applyTheme = (theme) => {
    document.body.classList.toggle("dark-theme", theme === "dark");
  };

  themeToggleButton.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

  loadSettings(); // Also calls updateButtonLabels

  // --- PWA Service Worker ---
  window.onload = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("Service Worker зарегистрирован:", reg))
        .catch((err) => console.log("Ошибка регистрации Service Worker:", err));
    }
  };
});
