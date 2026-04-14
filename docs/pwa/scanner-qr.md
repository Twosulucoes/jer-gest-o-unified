# Scanner QR Code — Módulos PWA

## Visão Geral

Os módulos PWA operacionais (Transporte, Alimentação, Alojamento) possuem scanner QR integrado via câmera do dispositivo para leitura de credenciais de participantes.

## Componente

`src/components/pwa/QrCodeScanner.tsx` — Scanner fullscreen compartilhado.

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `isOpen` | `boolean` | Controla visibilidade |
| `onScan` | `(payload: string) => void` | Callback ao detectar QR válido |
| `onClose` | `() => void` | Callback ao fechar |
| `allowedPrefixes` | `string[]` | Prefixos aceitos (ex: `["JER:"]`) |
| `title` | `string` | Título no header |

### Funcionalidades

- **Auto-start**: câmera inicia automaticamente ao abrir
- **Flip de câmera**: alternar entre frontal e traseira
- **Lanterna**: toggle de flash/torch
- **Fallback manual**: digitar código quando câmera não funciona
- **Debounce**: 2s entre leituras do mesmo código
- **Feedback tátil**: vibração ao detectar código
- **Timeout hint**: dica após 2 minutos sem detecção

## Biblioteca

Utiliza `html5-qrcode` v2.3.8 para decodificação via câmera web. Para ambiente nativo (Capacitor), usa `@capacitor-mlkit/barcode-scanning`.

## Formato do QR Code

Formato canônico: `jer:{event_id}:{participant_id}:{credential_code}`

Prefixos aceitos:
- `JER:` — logística geral (transporte, alimentação)
- `JER-ALJ:` — alojamento
- `jer:` — formato canônico

## Onde Testar

| Módulo | URL | Ação |
|--------|-----|------|
| Transporte - Embarque | `/pwa/transporte/embarque?tripId=...` | Botão "Scan" no header |
| Transporte - Scan | `/pwa/transporte/scan` | Botão "Escanear QR Code" |
| Alimentação | `/pwa/alimentacao/scan` | Botão "Escanear QR Code" |
| Alojamento | `/pwa/alojamento/scan` | Botão "Scan" no header |

## Troubleshooting

### Câmera não abre

1. Verifique se está acessando via **HTTPS** (obrigatório para câmera)
2. Android Chrome: Configurações → Privacidade → Câmera → permitir o site
3. iOS Safari: Ajustes → Safari → Câmera → Permitir
4. Tente o botão "Tentar Novamente"
5. Use o fallback "Digitar Código" se a câmera não funcionar

### Código não é reconhecido

- Verifique se o QR code segue o formato `jer:{event_id}:{participant_id}:{credential_code}`
- Credenciais com prefixo `JER:` ou `JER-ALJ:` são aceitas
- QR codes aleatórios são rejeitados

### Dispositivos testados

- Chrome Mobile (Android 10+)
- Safari Mobile (iOS 15+)
- Chrome Desktop (para desenvolvimento)

## Fallback Manual

Todos os módulos mantêm a opção de digitar o código manualmente via botão "Digitar Código" no scanner, útil quando:
- Câmera não funciona no dispositivo
- QR code está danificado/ilegível
- Ambiente sem câmera (desktop)
