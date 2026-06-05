<?php
header('Content-Type: application/json');

$backgroundFolder = __DIR__ . '/background.png';

if (!is_dir($backgroundFolder)) {
    echo json_encode(['error' => 'Folder not found', 'backgrounds' => []]);
    exit;
}

$files = array_values(array_filter(
    scandir($backgroundFolder),
    function($file) use ($backgroundFolder) {
        $path = $backgroundFolder . '/' . $file;
        if (is_dir($path)) return false;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        return in_array($ext, ['png', 'jpg', 'jpeg', 'webp']);
    }
));

$backgrounds = array_map(function($file, $index) {
    return [
        'id' => 'bg_' . $index,
        'name' => pathinfo($file, PATHINFO_FILENAME),
        'path' => 'background.png/' . $file,
        'thumbnail' => 'background.png/' . $file
    ];
}, $files, array_keys($files));

echo json_encode([
    'success' => true,
    'backgrounds' => $backgrounds,
    'count' => count($backgrounds)
]);
?>
