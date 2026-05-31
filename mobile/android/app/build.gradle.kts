plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.crosswebtemplate.app"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.crosswebtemplate.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            val zigMode = if (gradle.startParameter.taskNames.any { it.contains("Release") }) "release" else "debug"
            jniLibs.srcDirs("../../../.build/zig/android/$zigMode")
            assets.srcDirs("../../../.build/frontend")
        }
    }

    buildFeatures { buildConfig = true }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}
