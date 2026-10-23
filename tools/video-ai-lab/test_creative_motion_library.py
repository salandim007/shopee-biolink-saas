#!/usr/bin/env python3
"""Testes sem Docker, Ollama, FFmpeg ou acesso a producao."""
import json
import unittest

from creative_motion_library import plan_movements, validate_plan


class MotionLibraryTests(unittest.TestCase):
    def test_five_scenes_have_four_transitions_and_dora(self):
        plan = plan_movements(5)
        self.assertEqual(len(plan["transitions"]), 4)
        self.assertGreaterEqual(len({t["effect"] for t in plan["transitions"]}), 3)
        self.assertEqual(plan["voice"]["id"], "pf_dora")
        self.assertEqual(plan["voice"]["velocidade"], 0.85)
        self.assertFalse(plan["published"])
        validate_plan(json.loads(json.dumps(plan)))

    def test_less_than_four_scenes_rejected(self):
        with self.assertRaises(ValueError):
            plan_movements(3)

    def test_repeated_transition_rejected(self):
        plan = plan_movements()
        for t in plan["transitions"]:
            t["effect"] = "slide"
        with self.assertRaises(ValueError):
            validate_plan(plan)

    def test_no_automatic_publication(self):
        plan = plan_movements()
        plan["published"] = True
        with self.assertRaises(ValueError):
            validate_plan(plan)

    def test_movement_variation(self):
        self.assertNotEqual(plan_movements(seed=0)["scene_moves"], plan_movements(seed=1)["scene_moves"])


if __name__ == "__main__":
    unittest.main()
