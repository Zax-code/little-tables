from __future__ import annotations

import re
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEPLOY = ROOT / "deploy"
VALID_IMAGE = "ghcr.io/zax-code/little-tables:" + "a" * 40


def section_values(path: Path, section: str) -> list[str]:
    current = ""
    values: list[str] = []
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
        elif current == section and line and not line.startswith("#"):
            values.append(line)
    return values


class QuadletDeploymentTest(unittest.TestCase):
    def test_legacy_wrapper_units_are_replaced(self) -> None:
        self.assertFalse((DEPLOY / "little-tables.service").exists())
        self.assertFalse((DEPLOY / "little-tables-mongo.service").exists())

    def test_app_quadlet_preserves_runtime_contract(self) -> None:
        unit = section_values(DEPLOY / "little-tables.container.in", "Unit")
        container = section_values(DEPLOY / "little-tables.container.in", "Container")
        service = section_values(DEPLOY / "little-tables.container.in", "Service")

        self.assertIn("After=little-tables-mongo.container", unit)
        self.assertIn("Requires=little-tables-mongo.container", unit)
        self.assertEqual(container.count("Image=@LITTLE_TABLES_IMAGE@"), 1)
        self.assertIn("ContainerName=little-tables-app", container)
        self.assertIn("EnvironmentFile=/etc/little-tables/little-tables.env", container)
        self.assertIn("Network=host", container)
        self.assertIn("Memory=512m", container)
        self.assertIn("PidsLimit=256", container)
        self.assertIn("NoNewPrivileges=true", container)
        self.assertIn("Pull=never", container)
        self.assertIn("StopTimeout=15", container)
        self.assertIn("Restart=always", service)

    def test_mongo_quadlet_preserves_loopback_and_named_volume(self) -> None:
        container = section_values(DEPLOY / "little-tables-mongo.container", "Container")
        volume = section_values(DEPLOY / "little-tables-mongo-data.volume", "Volume")

        self.assertIn("Image=docker.io/library/mongo:7.0.17", container)
        self.assertIn("ContainerName=little-tables-mongo", container)
        self.assertIn("PublishPort=127.0.0.1:27018:27017", container)
        self.assertIn("Pull=never", container)
        self.assertIn("Volume=little-tables-mongo-data.volume:/data/db", container)
        self.assertIn("Memory=1g", container)
        self.assertIn("PidsLimit=512", container)
        self.assertEqual(volume, ["VolumeName=little-tables-mongo-data"])

    def test_renderer_accepts_only_an_immutable_project_image(self) -> None:
        renderer = DEPLOY / "render-little-tables-quadlet.sh"
        template = DEPLOY / "little-tables.container.in"
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "little-tables.container"
            subprocess.run(
                [str(renderer), VALID_IMAGE, str(template), str(output)],
                check=True,
            )
            rendered = output.read_text()
            self.assertIn(f"Image={VALID_IMAGE}", rendered)
            self.assertNotIn("@LITTLE_TABLES_IMAGE@", rendered)
            self.assertRegex(rendered, re.compile(r"^Image=.+$", re.MULTILINE))

            invalid = subprocess.run(
                [str(renderer), "ghcr.io/zax-code/little-tables:latest", str(template), str(output)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(invalid.returncode, 2)
            self.assertIn(f"Image={VALID_IMAGE}", output.read_text())


if __name__ == "__main__":
    unittest.main()
