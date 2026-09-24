#!/usr/bin/env python3
"""
PWA 아이콘 생성 스크립트 — B5(PWA 설치 + 웹 푸시).

생성 파일 (public/icons/):
  - icon-192.png            매니페스트 아이콘 (192x192)
  - icon-512.png            매니페스트 아이콘 (512x512, maskable 겸용)
  - apple-touch-icon-180.png  iOS 홈 화면 아이콘 (180x180, 불투명 배경 필수)
  - badge-72.png            푸시 알림 배지 (72x72, 투명 배경 + 흰 글자만)

디자인: manifest.json의 theme_color(#6366f1) 배경 + 흰색 "CM" 글자.
배지는 단색 흰 글자, 투명 배경 (OS가 배지 색을 알아서 입힌다).

의존성: python3 + Pillow (PIL). 시스템 DejaVu Sans Bold 폰트를 사용한다.
실행: python3 scripts/gen-icons.py
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

THEME_COLOR = (99, 102, 241, 255)  # #6366f1
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
]

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_centered_text(draw: ImageDraw.ImageDraw, size: int, text: str, font: ImageFont.FreeTypeFont, fill) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fill)


def make_app_icon(size: int, text: str = "CM") -> Image.Image:
    """theme_color 배경 + 흰색 텍스트 (불투명 — iOS 홈 아이콘·매니페스트 공용)."""
    img = Image.new("RGBA", (size, size), THEME_COLOR)
    draw = ImageDraw.Draw(img)
    font = load_font(int(size * 0.42))
    draw_centered_text(draw, size, text, font, WHITE)
    return img


def make_badge_icon(size: int, text: str = "CM") -> Image.Image:
    """투명 배경 + 흰색 텍스트만 (푸시 알림 배지 — OS가 마스킹한다)."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)
    font = load_font(int(size * 0.5))
    draw_centered_text(draw, size, text, font, WHITE)
    return img


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    make_app_icon(192).save(os.path.join(OUT_DIR, "icon-192.png"))
    make_app_icon(512).save(os.path.join(OUT_DIR, "icon-512.png"))
    # iOS는 apple-touch-icon에 알파 채널이 있으면 검은 배경으로 렌더링하므로 불투명으로 저장한다.
    make_app_icon(180).convert("RGB").save(os.path.join(OUT_DIR, "apple-touch-icon-180.png"))
    make_badge_icon(72).save(os.path.join(OUT_DIR, "badge-72.png"))

    for name in ("icon-192.png", "icon-512.png", "apple-touch-icon-180.png", "badge-72.png"):
        print(f"generated: {os.path.join(OUT_DIR, name)}")


if __name__ == "__main__":
    main()
