package com.matchchatapp

import android.content.Context
import com.facebook.react.ReactInstanceManager
import com.facebook.react.modules.network.NetworkingModule
import okhttp3.OkHttpClient

/**
 * Class responsible for loading Flipper inside your React Native application.
 * This is an enhanced version that works with Flipper v0.203.0 and Hermes.
 */
object ReactNativeFlipper {
  fun initializeFlipper(context: Context, reactInstanceManager: ReactInstanceManager) {
    println("ReactNativeFlipper.initializeFlipper called for Flipper v0.203.0 with Hermes support")
    
    try {
      // Use reflection to avoid direct dependencies that might cause compile issues
      val flipperUtils = Class.forName("com.facebook.flipper.android.utils.FlipperUtils")
      val shouldEnableFlipperMethod = flipperUtils.getMethod("shouldEnableFlipper", Context::class.java)
      val shouldEnableFlipper = shouldEnableFlipperMethod.invoke(null, context) as Boolean
      
      if (shouldEnableFlipper) {
        println("Flipper should be enabled, initializing...")
        
        // Get the FlipperClient instance
        val androidFlipperClient = Class.forName("com.facebook.flipper.android.AndroidFlipperClient")
        val getInstanceMethod = androidFlipperClient.getMethod("getInstance", Context::class.java)
        val client = getInstanceMethod.invoke(null, context)
        
        // Add the NetworkFlipperPlugin
        val networkFlipperPlugin = Class.forName("com.facebook.flipper.plugins.network.NetworkFlipperPlugin").newInstance()
        val addPluginMethod = client.javaClass.getMethod("addPlugin", Class.forName("com.facebook.flipper.core.FlipperPlugin"))
        addPluginMethod.invoke(client, networkFlipperPlugin)
        
        // Add Fresco FlipperPlugin if Fresco is used
        try {
          val imagePipelineFactory = Class.forName("com.facebook.drawee.backends.pipeline.Fresco")
            .getDeclaredMethod("getImagePipelineFactory")
            .invoke(null)
          
          if (imagePipelineFactory != null) {
            val frescoFlipperPlugin = Class.forName("com.facebook.flipper.plugins.fresco.FrescoFlipperPlugin")
              .getConstructor(imagePipelineFactory.javaClass)
              .newInstance(imagePipelineFactory)
            
            addPluginMethod.invoke(client, frescoFlipperPlugin)
            println("Successfully added Fresco Flipper plugin")
          }
        } catch (e: Exception) {
          println("Fresco Flipper plugin setup skipped: ${e.message}")
        }
        
        // Add React DevTools plugin for Hermes support
        try {
          val reactDevToolsPlugin = Class.forName("com.facebook.flipper.plugins.react.ReactFlipperPlugin")
            .getConstructor()
            .newInstance()
          addPluginMethod.invoke(client, reactDevToolsPlugin)
          println("Successfully added React DevTools plugin for Hermes support")
        } catch (e: Exception) {
          println("Failed to add React DevTools plugin: ${e.message}")
          e.printStackTrace()
        }
        
        // Add Hermes Debugger plugin
        try {
          val hermesDebuggerPlugin = Class.forName("com.facebook.flipper.plugins.inspector.InspectorFlipperPlugin")
            .getConstructor(Context::class.java, Boolean::class.javaPrimitiveType)
            .newInstance(context, true)
          addPluginMethod.invoke(client, hermesDebuggerPlugin)
          println("Successfully added Hermes Debugger plugin")
        } catch (e: Exception) {
          println("Failed to add Hermes Debugger plugin: ${e.message}")
          e.printStackTrace()
        }
        
        // Start the client
        val startMethod = client.javaClass.getMethod("start")
        startMethod.invoke(client)
        
        // Set up the network interceptor
        NetworkingModule.setCustomClientBuilder { builder: OkHttpClient.Builder ->
          try {
            val interceptorClass = Class.forName("com.facebook.flipper.plugins.network.FlipperOkhttpInterceptor")
            val constructor = interceptorClass.getConstructor(networkFlipperPlugin.javaClass)
            val interceptor = constructor.newInstance(networkFlipperPlugin)
            builder.addNetworkInterceptor(interceptor as okhttp3.Interceptor)
            println("Successfully added Flipper network interceptor")
          } catch (e: Exception) {
            println("Failed to add Flipper network interceptor: ${e.message}")
            e.printStackTrace()
          }
        }
        
        // Register for React Native Hermes debugging
        try {
          val hermesClass = Class.forName("com.facebook.hermes.reactexecutor.HermesExecutorFactory")
          if (hermesClass != null) {
            println("Hermes is available, setting up Hermes debugging with Flipper")
            
            // Connect React DevTools to Hermes
            val reactInstanceDevHelper = reactInstanceManager.javaClass.getDeclaredMethod("getDevSupportManager").invoke(reactInstanceManager)
            val setDevSupportEnabledMethod = reactInstanceDevHelper.javaClass.getDeclaredMethod("setDevSupportEnabled", Boolean::class.javaPrimitiveType)
            setDevSupportEnabledMethod.invoke(reactInstanceDevHelper, true)
            
            println("Hermes debugging setup completed successfully")
          }
        } catch (e: Exception) {
          println("Hermes debugging setup failed: ${e.message}")
          e.printStackTrace()
        }
        
        println("Flipper initialization completed successfully")
      } else {
        println("Flipper should not be enabled in this context")
      }
    } catch (e: Exception) {
      println("Flipper initialization failed: ${e.message}")
      e.printStackTrace()
    }
  }
}