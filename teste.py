from pathlib import Path
import base64

# Caminho da imagem original
img_path = Path("public/logo.png")  # ou o nome do seu arquivo real
output_path = Path("backend/base64.txt")

# Lê e converte para base64
b64 = base64.b64encode(img_path.read_bytes()).decode()

# Salva no txt
output_path.write_text(b64)
print("✅ base64.txt gerado com sucesso!")