import numpy as np
from scipy.io import wavfile

sample_rate = 44100
duration = 7.5  # slightly longer to let the boom ring out
t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

# 1. Building low-frequency drone (starts low, gets slightly higher and much louder)
# Base frequency starts at 40 Hz, ends at 80 Hz
freq = np.linspace(40, 80, len(t))
phase = np.cumsum(freq) / sample_rate * 2 * np.pi
drone = np.sin(phase)

# Add some harmonics and dissonance
drone += 0.5 * np.sin(phase * 1.5)
drone += 0.25 * np.sin(phase * 2.1)

# Drone envelope (builds up over 6.5 seconds, then stays, then fades at the very end)
drone_env = np.interp(t, [0, 6.5, 7.0, 7.5], [0, 0.8, 0.8, 0])
drone *= drone_env

# 2. Rhythmic rumble/heartbeat
rumble_freq = 5
rumble = np.sin(2 * np.pi * rumble_freq * t)
rumble_env = np.interp(t, [0, 6.5, 7.0], [0, 0.5, 0])
drone += rumble * drone_env * 0.5

# 3. Metallic hit/Boom at ~6.8s
boom_start = 6.8
boom_idx = int(boom_start * sample_rate)
boom_length = len(t) - boom_idx
if boom_length > 0:
    t_boom = np.linspace(0, duration - boom_start, boom_length, endpoint=False)

    # Noise burst for impact
    noise = np.random.normal(0, 1, boom_length)
    noise_env = np.exp(-t_boom * 15)  # fast decay
    impact = noise * noise_env

    # Sub boom
    sub_freq = np.linspace(150, 30, boom_length)
    sub_phase = np.cumsum(sub_freq) / sample_rate * 2 * np.pi
    sub = np.sin(sub_phase)
    sub_env = np.exp(-t_boom * 2)
    impact += sub * sub_env * 1.5

    # Metallic scrape/ring (FM synthesis-like)
    metal_freq = 800
    modulator = np.sin(2 * np.pi * 50 * t_boom)
    metal = np.sin(2 * np.pi * metal_freq * t_boom + 5 * modulator)
    metal_env = np.exp(-t_boom * 4)
    impact += metal * metal_env * 0.5

    # Add boom to main signal
    audio = drone.copy()
    audio[boom_idx:] += impact
else:
    audio = drone

# Normalize
audio = audio / np.max(np.abs(audio)) * 0.9

# Save to wav
wavfile.write('public/horror.wav', sample_rate, audio.astype(np.float32))
print("Audio generated at public/horror.wav")
