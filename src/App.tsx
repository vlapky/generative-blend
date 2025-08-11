import { useState, useRef, useEffect } from 'react'
import './App.css'

type BrushShape = 'circle' | 'square' | 'rounded-square' | 'svg'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)

  // Настройки кисти
  const [brushShape, setBrushShape] = useState<BrushShape>('circle')
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushWidth, setBrushWidth] = useState(20)
  const [brushHeight, setBrushHeight] = useState(20)
  const [isDrawing, setIsDrawing] = useState(false)

  // Палитра пользовательских цветов
  const [colorPalette, setColorPalette] = useState<string[]>(['#000000'])
  const [currentColorIndex, setCurrentColorIndex] = useState(0)

  // SVG кисть
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [svgImage, setSvgImage] = useState<HTMLImageElement | null>(null)
  const [svgImages, setSvgImages] = useState<{ [key: string]: HTMLImageElement }>({});

  // Настройки эффектов
  const [colorVariation, setColorVariation] = useState(30)
  const [glowIntensity, setGlowIntensity] = useState(0.1)
  const [strokeDelay, setStrokeDelay] = useState(0) // Задержка в мс

  // Для отслеживания времени последнего мазка
  const [lastStrokeTime, setLastStrokeTime] = useState(0)
  
  // Состояния для записи видео
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [_, setRecordedChunks] = useState<Blob[]>([])

  // Функция для обновления размера canvas с учетом высокого разрешения
  const updateCanvasSize = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Получаем devicePixelRatio для высокого разрешения
    const devicePixelRatio = window.devicePixelRatio || 1

    // Устанавливаем размер canvas в пикселях
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio

    // Устанавливаем CSS размер
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'

    // Масштабируем контекст для высокого разрешения
    ctx.scale(devicePixelRatio, devicePixelRatio)

    // Очищаем canvas
    ctx.clearRect(0, 0, width, height)
  }



  // Функции для работы с палитрой цветов
  const addColorToPalette = () => {
    if (!colorPalette.includes(brushColor)) {
      setColorPalette([...colorPalette, brushColor])

      setSvgImages({});
      [...colorPalette, brushColor].forEach(color => {
        svgContent && createSvgImageWithColor(svgContent, color)
      })
    }
  }

  const removeColorFromPalette = (colorToRemove: string) => {
    const newPalette = colorPalette.filter(color => color !== colorToRemove)
    if (newPalette.length === 0) {
      setColorPalette(['#000000'])
      setCurrentColorIndex(0)
    } else {
      setColorPalette(newPalette)
      if (currentColorIndex >= newPalette.length) {
        setCurrentColorIndex(0)
      }
    }

    setSvgImages({});
    colorPalette.forEach(color => {
      svgContent && createSvgImageWithColor(svgContent, color)
    })
  }

  const getCurrentPaletteColor = () => {
    return colorPalette[currentColorIndex] || '#000000'
  }

  const cycleToNextColor = () => {
    if (colorPalette.length > 1) {
      setCurrentColorIndex((currentColorIndex + 1) % colorPalette.length)
    }
  }

  // Функции для работы с SVG
  const handleSvgUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'image/svg+xml') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const svgText = e.target?.result as string
        setSvgContent(svgText)
        createSvgImage(svgText)

        setSvgImages({});
        colorPalette.forEach(color => {
          createSvgImageWithColor(svgText, color)
        })
      }
      reader.readAsText(file)
    }
  }

  const createSvgImageWithColor = (svgText: string, color: string) => {
    const blob = new Blob([svgText.replace(/fill="[^" ]+"/g, `fill="${color}"`)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      setSvgImages((prev) => ({ ...prev, [color]: img }))
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const createSvgImage = (svgText: string) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      setSvgImage(img)
      setBrushShape('svg')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  // Функция для генерации случайного цвета с вариацией
  const getColorVariation = (baseColor: string) => {
    // Конвертируем hex в RGB
    const hex = baseColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    // Добавляем случайную вариацию на основе настроек
    const newR = Math.max(0, Math.min(255, r + (Math.random() - 0.5) * colorVariation * 2))
    const newG = Math.max(0, Math.min(255, g + (Math.random() - 0.5) * colorVariation * 2))
    const newB = Math.max(0, Math.min(255, b + (Math.random() - 0.5) * colorVariation * 2))

    return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`
  }

  // Функция для рисования кистью с эффектами
  const drawBrush = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Сохраняем текущее состояние контекста
    ctx.save()

    // Используем текущий цвет из палитры
    const currentColor = getCurrentPaletteColor()

    // Добавляем эффект размытия/свечения
    ctx.shadowColor = currentColor
    ctx.shadowBlur = Math.max(brushWidth, brushHeight) * glowIntensity
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Рисуем основной мазок с вариацией цвета
    const mainColor = getColorVariation(currentColor)
    ctx.fillStyle = mainColor

    // Рисуем несколько слоев для создания объема
    const layers = 3
    for (let i = 0; i < layers; i++) {
      const layerWidth = brushWidth * (1 - i * 0.15)
      const layerHeight = brushHeight * (1 - i * 0.15)
      const layerOpacity = 1 - i * 0.2
      const layerColor = getColorVariation(currentColor)

      // Устанавливаем прозрачность для слоя
      ctx.globalAlpha = layerOpacity
      ctx.fillStyle = layerColor

      // Небольшое смещение для объема
      const offsetX = (Math.random() - 0.5) * 2
      const offsetY = (Math.random() - 0.5) * 2

      switch (brushShape) {
        case 'circle':
          // Для круга используем эллипс с разной шириной и высотой
          ctx.beginPath()
          ctx.ellipse(x + offsetX, y + offsetY, layerWidth / 2, layerHeight / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          break

        case 'square':
          ctx.fillRect(
            x - layerWidth / 2 + offsetX,
            y - layerHeight / 2 + offsetY,
            layerWidth,
            layerHeight
          )
          break

        case 'rounded-square':
          const radius = Math.min(layerWidth, layerHeight) / 6
          ctx.beginPath()
          ctx.roundRect(
            x - layerWidth / 2 + offsetX,
            y - layerHeight / 2 + offsetY,
            layerWidth,
            layerHeight,
            radius
          )
          ctx.fill()
          break

        case 'svg':
          if (svgImage) {
            // Сохраняем текущие настройки композиции
            const prevComposite = ctx.globalCompositeOperation

            // Используем multiply для применения цвета
            ctx.globalCompositeOperation = 'multiply'

            // Рисуем SVG с масштабированием
            ctx.drawImage(
              // svgImage,
              svgImages[currentColor],
              x - layerWidth / 2 + offsetX,
              y - layerHeight / 2 + offsetY,
              layerWidth,
              layerHeight
            )

            // Восстанавливаем композицию
            ctx.globalCompositeOperation = prevComposite
          }
          break
      }
    }

    // Восстанавливаем состояние контекста
    ctx.restore()
  }

  // Проверка, можно ли рисовать (прошло ли достаточно времени)
  const canDraw = () => {
    const currentTime = Date.now()
    return currentTime - lastStrokeTime >= strokeDelay
  }

  // Получение координат мыши относительно canvas
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1),
      y: (e.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1)
    }
  }

  // Обработчики событий мыши
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const pos = getMousePos(e)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      drawBrush(ctx, pos.x, pos.y)
      setLastStrokeTime(Date.now()) // Обновляем время последнего мазка
      cycleToNextColor() // Переключаемся на следующий цвет
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    // Проверяем, прошло ли достаточно времени для следующего мазка
    if (!canDraw()) return

    const pos = getMousePos(e)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      drawBrush(ctx, pos.x, pos.y)
      setLastStrokeTime(Date.now()) // Обновляем время последнего мазка
      cycleToNextColor() // Переключаемся на следующий цвет
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const handleMouseLeave = () => {
    setIsDrawing(false)
  }

  // Очистка canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, width, height)
    }
  }

  // Функции для записи видео
  const startRecording = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const stream = canvas.captureStream(30) // 30 FPS
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      const chunks: Blob[] = []
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        setRecordedChunks([blob])
        downloadVideo(blob)
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordedChunks([])
    } catch (error) {
      console.error('Ошибка при запуске записи:', error)
      alert('Не удалось начать запись видео. Убедитесь, что ваш браузер поддерживает эту функцию.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  const downloadVideo = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `canvas_recording_${new Date().getTime()}.webm`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Сохранение canvas как PNG
  const saveAsPNG = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Создаем ссылку для скачивания
    const link = document.createElement('a')
    link.download = `artwork_${new Date().getTime()}.png`
    link.href = canvas.toDataURL()

    // Программно кликаем по ссылке для скачивания
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Обновляем canvas при изменении размеров
  useEffect(() => {
    updateCanvasSize()
  }, [width, height])

  // Обработчики изменения размеров
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value > 0) {
      setWidth(value)
    }
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value > 0) {
      setHeight(value)
    }
  }

  return (
    <div className="app">
      <h1>Canvas с кистью для рисования</h1>

      <div className="controls">
        <div className="input-group">
          <label htmlFor="width">Ширина:</label>
          <input
            id="width"
            type="number"
            value={width}
            onChange={handleWidthChange}
            min="100"
            max="2000"
          />
          <span>px</span>
        </div>

        <div className="input-group">
          <label htmlFor="height">Высота:</label>
          <input
            id="height"
            type="number"
            value={height}
            onChange={handleHeightChange}
            min="100"
            max="2000"
          />
          <span>px</span>
        </div>
      </div>

      <div className="brush-controls">
        <div className="shape-controls">
          <h3>Форма кисти</h3>
          <div className="shape-buttons">
            <button
              className={brushShape === 'circle' ? 'active' : ''}
              onClick={() => setBrushShape('circle')}
            >
              ●
            </button>
            <button
              className={brushShape === 'square' ? 'active' : ''}
              onClick={() => setBrushShape('square')}
            >
              ■
            </button>
            <button
              className={brushShape === 'rounded-square' ? 'active' : ''}
              onClick={() => setBrushShape('rounded-square')}
            >
              ▢
            </button>
            <button
              className={brushShape === 'svg' ? 'active' : ''}
              onClick={() => setBrushShape('svg')}
              disabled={!svgImage}
              title={svgImage ? 'SVG кисть' : 'Загрузите SVG файл'}
            >
              🎨
            </button>
          </div>

          <div className="svg-upload">
            <label htmlFor="svg-upload" className="svg-upload-label">
              📁 Загрузить SVG
            </label>
            <input
              id="svg-upload"
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleSvgUpload}
              className="svg-upload-input"
            />
            {svgContent && (
              <div className="svg-preview">
                <div
                  className="svg-preview-content"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
                <span className="svg-status">SVG загружен ✓</span>
              </div>
            )}
          </div>
        </div>

        <div className="brush-section">
          <h3>Палитра цветов</h3>
          <div className="palette-controls">
            <div className="color-input-section">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="color-picker"
              />
              <button
                onClick={addColorToPalette}
                className="add-color-btn"
                title="Добавить цвет в палитру"
              >
                +
              </button>
            </div>

            <div className="palette-list">
              {colorPalette.map((color, index) => (
                <div
                  key={`${color}-${index}`}
                  className={`palette-item ${index === currentColorIndex ? 'active' : ''}`}
                >
                  <div
                    className="palette-color"
                    style={{ backgroundColor: color }}
                    title={`Цвет: ${color}`}
                  />
                  <span className="palette-index">{index + 1}</span>
                  {colorPalette.length > 1 && (
                    <button
                      onClick={() => removeColorFromPalette(color)}
                      className="remove-color-btn"
                      title="Удалить цвет"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="palette-info">
              <span>Текущий: {currentColorIndex + 1} из {colorPalette.length}</span>
            </div>
          </div>
        </div>

        <div className="brush-section">
          <h3>Ширина: {brushWidth}px</h3>
          <input
            type="range"
            min="1"
            max="200"
            value={brushWidth}
            onChange={(e) => setBrushWidth(parseInt(e.target.value))}
            className="size-slider"
          />
        </div>

        <div className="brush-section">
          <h3>Высота: {brushHeight}px</h3>
          <input
            type="range"
            min="1"
            max="200"
            value={brushHeight}
            onChange={(e) => setBrushHeight(parseInt(e.target.value))}
            className="size-slider"
          />
          <div className="size-preview">
            <div
              className={`preview-shape ${brushShape}`}
              style={{
                width: `${Math.min(brushWidth, 50)}px`,
                height: `${Math.min(brushHeight, 50)}px`,
                backgroundColor: brushColor
              }}
            />
          </div>
        </div>

        <div className="brush-section">
          <h3>Вариация цвета: {colorVariation}</h3>
          <input
            type="range"
            min="0"
            max="60"
            value={colorVariation}
            onChange={(e) => setColorVariation(parseInt(e.target.value))}
            className="effect-slider"
          />
          <div className="effect-description">
            Случайное изменение цвета
          </div>
        </div>

        <div className="brush-section">
          <h3>Интенсивность свечения: {glowIntensity.toFixed(1)}</h3>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={glowIntensity}
            onChange={(e) => setGlowIntensity(parseFloat(e.target.value))}
            className="effect-slider"
          />
          <div className="effect-description">
            Эффект размытия и объема
          </div>
        </div>

        <div className="brush-section">
          <h3>Задержка между мазками: {strokeDelay}мс</h3>
          <input
            type="range"
            min="0"
            max="300"
            step="10"
            value={strokeDelay}
            onChange={(e) => setStrokeDelay(parseInt(e.target.value))}
            className="effect-slider"
          />
          <div className="effect-description">
            Расстояние между фигурами при рисовании
          </div>
        </div>

        <div className="brush-section">
          <div className="action-buttons">
            <button onClick={clearCanvas} className="clear-btn">
              🗑️ Очистить
            </button>
            <button onClick={saveAsPNG} className="save-btn">
              💾 Сохранить PNG
            </button>
            <button 
              onClick={toggleRecording} 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Остановить запись' : 'Начать запись видео'}
            >
              {isRecording ? '⏹️ Остановить' : '🎥 Запись'}
            </button>
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="high-res-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  )
}

export default App
