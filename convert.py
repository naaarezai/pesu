import os
from PIL import Image
import pillow_heif

pillow_heif.register_heif_opener()

for file in os.listdir('.'):
    if file.endswith('.HEIC'):
        print(f"Converting {file}")
        img = Image.open(file)
        img.save(file.replace('.HEIC', '.jpg'))
print("Done")
