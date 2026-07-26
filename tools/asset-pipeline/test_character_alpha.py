#!/usr/bin/env python3
"""Focused tests for deterministic character alpha pixel processing."""

from __future__ import annotations

import unittest

from character_alpha import protect_foreground_pixels


class ProtectForegroundPixelsTest(unittest.TestCase):
    def test_filters_noise_and_preserves_reviewed_foreground_contracts(self) -> None:
        width = 11
        height = 11
        source = bytearray((255, 0, 255, 255) * width * height)
        soft = bytearray((0, 0, 0, 0) * width * height)
        edge = bytearray((0, 0, 0, 0) * width * height)
        hard = bytearray(width * height)

        def set_pixel(data: bytearray, x: int, y: int, rgba: tuple[int, ...]) -> None:
            start = (y * width + x) * 4
            data[start : start + 4] = bytes(rgba)

        def get_pixel(data: bytes, x: int, y: int) -> tuple[int, ...]:
            start = (y * width + x) * 4
            return tuple(data[start : start + 4])

        for y in range(3, 8):
            for x in range(3, 8):
                set_pixel(source, x, y, (180, 110, 220, 255))
                set_pixel(soft, x, y, (90, 90, 90, 128))
                set_pixel(edge, x, y, (70, 70, 70, 200))
                hard[y * width + x] = 255

        for y in range(8, 10):
            for x in range(8, 10):
                set_pixel(source, x, y, (0, 120, 255, 255))
                set_pixel(soft, x, y, (0, 100, 200, 160))
                set_pixel(edge, x, y, (0, 90, 180, 220))
                hard[y * width + x] = 255

        hard[1 * width + 1] = 255
        set_pixel(soft, 1, 1, (255, 0, 255, 180))
        hard[5 * width] = 255
        hard[5 * width + 1] = 255
        set_pixel(soft, 0, 5, (255, 0, 255, 180))
        set_pixel(soft, 1, 5, (255, 0, 255, 180))

        result = protect_foreground_pixels(
            bytes(source),
            bytes(soft),
            bytes(edge),
            bytes(hard),
            width,
            height,
            erosion_pixels=1,
            minimum_component_pixels=4,
        )

        self.assertEqual(get_pixel(result, 5, 5), (180, 110, 220, 255))
        self.assertEqual(get_pixel(result, 3, 3), (70, 70, 70, 128))
        self.assertEqual(get_pixel(result, 8, 8), (0, 90, 180, 160))
        self.assertEqual(get_pixel(result, 1, 1), (0, 0, 0, 0))
        self.assertEqual(get_pixel(result, 0, 5), (0, 0, 0, 0))
        self.assertEqual(get_pixel(result, 1, 5), (0, 0, 0, 0))

    def test_rejects_mismatched_pixel_buffers(self) -> None:
        with self.assertRaisesRegex(ValueError, "hard alpha"):
            protect_foreground_pixels(
                bytes(3 * 3 * 4),
                bytes(3 * 3 * 4),
                bytes(3 * 3 * 4),
                bytes(2 * 3),
                3,
                3,
                erosion_pixels=1,
                minimum_component_pixels=1,
            )


if __name__ == "__main__":
    unittest.main()
