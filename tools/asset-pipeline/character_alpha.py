"""Dependency-free pixel operations for reviewed character alpha mattes."""

from __future__ import annotations


def _validate_buffer(name: str, data: bytes, expected_length: int) -> None:
    if len(data) != expected_length:
        raise ValueError(
            f"{name} has {len(data)} bytes, expected {expected_length}",
        )


def _retained_components(
    hard_alpha: bytes,
    width: int,
    height: int,
    minimum_component_pixels: int,
) -> bytearray:
    pixel_count = width * height
    visited = bytearray(pixel_count)
    retained = bytearray(pixel_count)
    for start, alpha in enumerate(hard_alpha):
        if alpha == 0 or visited[start]:
            continue
        visited[start] = 1
        stack = [start]
        component: list[int] = []
        touches_border = False
        while stack:
            index = stack.pop()
            component.append(index)
            x = index % width
            y = index // width
            touches_border = touches_border or (
                x == 0 or y == 0 or x == width - 1 or y == height - 1
            )
            if x > 0:
                neighbor = index - 1
                if hard_alpha[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    stack.append(neighbor)
            if x < width - 1:
                neighbor = index + 1
                if hard_alpha[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    stack.append(neighbor)
            if y > 0:
                neighbor = index - width
                if hard_alpha[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    stack.append(neighbor)
            if y < height - 1:
                neighbor = index + width
                if hard_alpha[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    stack.append(neighbor)
        if not touches_border and len(component) >= minimum_component_pixels:
            for index in component:
                retained[index] = 255
    return retained


def _erode(mask: bytearray, width: int, height: int, pixels: int) -> bytearray:
    eroded = mask
    for _ in range(pixels):
        next_mask = bytearray(width * height)
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                index = y * width + x
                if all(
                    eroded[(y + offset_y) * width + x + offset_x]
                    for offset_y in (-1, 0, 1)
                    for offset_x in (-1, 0, 1)
                ):
                    next_mask[index] = 255
        eroded = next_mask
    return eroded


def protect_foreground_pixels(
    source_rgba: bytes,
    soft_rgba: bytes,
    edge_rgba: bytes,
    hard_alpha: bytes,
    width: int,
    height: int,
    erosion_pixels: int,
    minimum_component_pixels: int,
) -> bytes:
    """Combine reviewed mattes while restoring only eroded subject interiors."""
    if width < 1 or height < 1:
        raise ValueError("width and height must be at least 1")
    if erosion_pixels < 1:
        raise ValueError("erosion pixels must be at least 1")
    if minimum_component_pixels < 1:
        raise ValueError("minimum component pixels must be at least 1")

    pixel_count = width * height
    _validate_buffer("source RGBA", source_rgba, pixel_count * 4)
    _validate_buffer("soft RGBA", soft_rgba, pixel_count * 4)
    _validate_buffer("edge RGBA", edge_rgba, pixel_count * 4)
    _validate_buffer("hard alpha", hard_alpha, pixel_count)

    retained = _retained_components(
        hard_alpha,
        width,
        height,
        minimum_component_pixels,
    )
    interior = _erode(retained, width, height, erosion_pixels)
    output = bytearray(soft_rgba)
    for index in range(pixel_count):
        rgba_index = index * 4
        if retained[index] == 0:
            output[rgba_index : rgba_index + 4] = b"\0\0\0\0"
        elif interior[index] == 255:
            output[rgba_index : rgba_index + 3] = source_rgba[
                rgba_index : rgba_index + 3
            ]
            output[rgba_index + 3] = 255
        else:
            output[rgba_index : rgba_index + 3] = edge_rgba[
                rgba_index : rgba_index + 3
            ]
    return bytes(output)
