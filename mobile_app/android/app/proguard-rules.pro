# Flutter ProGuard / R8 rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# SharedPreferences and Pigeon platform implementations
-keep class io.flutter.plugins.sharedpreferences.** { *; }
-keep class dev.flutter.pigeon.shared_preferences_android.** { *; }

# Ensure methods with @Keep or FlutterPlugin interfaces are never stripped
-keepattributes *Annotation*
-keep class * implements io.flutter.embedding.engine.plugins.FlutterPlugin { *; }
