"""Build small surface textures from CDPR's original Streetview press image.
Source: https://press.cdprojektred.com/en/224/808
Keep the full press image in .cache/references/Streetview.png.
"""
from pathlib import Path
from PIL import Image

source = Image.open('.cache/references/Streetview.png').convert('RGB')
atlas = Image.new('RGB', (2048, 1024), (25, 36, 37))
# Coordinates refer to the original 2880 x 1800 press image. Each quadrilateral
# is an individual physical sign/window surface, not a gameplay backdrop.
items = [
    ((0, 0, 384, 512), [(1026,476),(1202,459),(1200,726),(1025,756)]),
    ((384, 0, 256, 384), [(2584,948),(2758,944),(2757,1175),(2580,1169)]),
    ((640, 0, 256, 512), [(2483,0),(2695,0),(2691,294),(2479,355)]),
    ((896, 0, 384, 384), [(57,435),(400,460),(400,637),(57,610)]),
    ((1280, 0, 256, 512), [(964,88),(1054,116),(1025,558),(939,535)]),
    ((1536, 0, 256, 384), [(1598,0),(1705,0),(1705,196),(1598,196)]),
    ((0, 512, 768, 256), [(54,50),(630,50),(630,249),(54,249)]),
    ((768, 512, 384, 128), [(877,531),(1015,553),(1015,607),(877,586)]),
    ((1152, 512, 256, 128), [(661,1369),(738,1380),(738,1407),(662,1397)]),
    ((1408, 512, 512, 256), [(490,839),(563,839),(563,880),(490,880)]),
]
for (x,y,w,h), (tl,tr,br,bl) in items:
    patch = source.transform((w,h), Image.Transform.QUAD,
        (*tl,*bl,*br,*tr), Image.Resampling.BICUBIC)
    atlas.paste(patch,(x,y))
Path('public/assets/textures').mkdir(parents=True,exist_ok=True)
atlas.save('public/assets/textures/street-details.webp',quality=95,method=6)
print('Prepared compact Streetview surface atlas')
