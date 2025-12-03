import { SelectProps } from "@cloudscape-design/components";
export abstract class OptionsHelper {
  static getSelectOption(model?: string): SelectProps.Option | null {
    if (!model) return null;
    const [, name] = model.split("::") ?? [];
    if (!name) return null;

    return {
      label: name,
      value: model,
    };
  }

  static parseValue(value?: string) {
    const retValue = {
      provider: "",
      name: "",
    };

    try {
      if (!value) return retValue;
      const [provider, name] = value.split("::") ?? [];

      return {
        provider,
        name,
      };
    } catch (error) {
      console.error(error);
      return retValue;
    }
  }

  static parseWorkspaceValue(workspace?: SelectProps.Option): string {
    try {
      if (!workspace?.value) return "";

      const isExistingWorkspace =
        (workspace?.value.split("::") ?? []).length > 1;

      if (isExistingWorkspace) {
        return workspace.value;
      }

      return workspace?.label + "::" + workspace?.value;
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  static getSelectOptionGroups<T extends { provider: string; name: string }>(
    data: T[],
    addNone: boolean = false
  ): (SelectProps.OptionGroup | SelectProps.Option)[] {
    const modelsMap = new Map<string, T[]>();
    data.forEach((item) => {
      let items = modelsMap.get(item.provider);
      if (!items) {
        items = [];
        modelsMap.set(item.provider, [item]);
      } else {
        modelsMap.set(item.provider, [...items, item]);
      }
    });

    const keys = [...modelsMap.keys()];
    keys.sort((a, b) => a.localeCompare(b));

    const options: SelectProps.OptionGroup[] = keys.map((key) => {
      const items = modelsMap.get(key);
      items?.sort((a, b) => a.name.localeCompare(b.name));

      return {
        label: this.getProviderLabel(key),
        options:
          items?.map((item) => ({
            label: item.name,
            value: `${item.provider}::${item.name}`,
          })) ?? [],
      };
    });

    if (addNone) {
      return [
        {
          label: "None",
          value: "__none__",
        },
        ...options,
      ];
    }

    return options;
  }

  static getSelectOptions<T extends { id: string; name: string }>(data: T[]) {
    data?.sort((a, b) => a.name.localeCompare(b.name));

    const options: SelectProps.Option[] = data.map((item) => {
      return {
        label: item.name,
        value: item.id,
      };
    });

    return options;
  }

  static getProviderLabel(provider: string) {
    let label = provider;
    if (label === "sagemaker") label = "SageMaker";
    else if (label === "bedrock") label = "Bedrock";
    else if (label === "openai") label = "OpenAI";

    return label;
  }

  static getRolesSelectOptions<T extends string>(data: T[]) {
    data?.sort((a, b) => a.localeCompare(b));

    const options: SelectProps.Option[] = data.map((item) => {
      return {
        label: item,
        value: item,
      };
    });

    return options;
  }

  static getReadableModelName(modelName: string): string {
    const lowerName = modelName.toLowerCase();

    // Claude variants (check more specific versions first)
    if (lowerName.includes("claude")) {
      if (lowerName.includes("opus-4") || lowerName.includes("opus4")) {
        return "Claude Opus 4";
      } else if (lowerName.includes("sonnet-4-5") || lowerName.includes("sonnet-4.5") || lowerName.includes("sonnet4-5") || lowerName.includes("sonnet4.5")) {
        return "Claude Sonnet 4.5";
      } else if (lowerName.includes("sonnet-4") || lowerName.includes("sonnet4")) {
        return "Claude Sonnet 4";
      } else if (lowerName.includes("3-7-sonnet") || lowerName.includes("3.7-sonnet")) {
        return "Claude 3.7 Sonnet";
      } else if (lowerName.includes("3-5-sonnet") || lowerName.includes("3.5-sonnet")) {
        return "Claude 3.5 Sonnet";
      } else if (lowerName.includes("3-5-haiku") || lowerName.includes("3.5-haiku")) {
        return "Claude 3.5 Haiku";
      } else if (lowerName.includes("3-opus") || lowerName.includes("opus-3")) {
        return "Claude 3 Opus";
      } else if (lowerName.includes("3-sonnet")) {
        return "Claude 3 Sonnet";
      } else if (lowerName.includes("3-haiku") || lowerName.includes("haiku-3")) {
        return "Claude 3 Haiku";
      } else if (lowerName.includes("v2") || lowerName.includes("2")) {
        return "Claude 2";
      } else if (lowerName.includes("instant")) {
        return "Claude Instant";
      }
      return "Claude";
    }

    // Llama variants
    if (lowerName.includes("llama")) {
      if (lowerName.includes("llama4") || lowerName.includes("llama-4")) {
        if (lowerName.includes("scout")) {
          return "Llama 4 Scout";
        } else if (lowerName.includes("maverick")) {
          return "Llama 4 Maverick";
        }
        return "Llama 4";
      } else if (lowerName.includes("3-3") || lowerName.includes("3.3")) {
        return "Llama 3.3";
      } else if (lowerName.includes("3-2") || lowerName.includes("3.2")) {
        return "Llama 3.2";
      } else if (lowerName.includes("3-1") || lowerName.includes("3.1")) {
        return "Llama 3.1";
      } else if (lowerName.includes("3")) {
        return "Llama 3";
      } else if (lowerName.includes("2")) {
        return "Llama 2";
      }
      return "Llama";
    }

    // AI21 Jamba
    if (lowerName.includes("jamba")) {
      if (lowerName.includes("1-5") || lowerName.includes("1.5")) {
        if (lowerName.includes("mini")) {
          return "AI21 Jamba 1.5 Mini";
        }
        return "AI21 Jamba 1.5";
      }
      return "AI21 Jamba";
    }

    // Mistral variants
    if (lowerName.includes("mistral") || lowerName.includes("mixtral") || lowerName.includes("pixtral")) {
      if (lowerName.includes("pixtral") && lowerName.includes("large")) {
        return "Mistral Pixtral Large";
      } else if (lowerName.includes("pixtral")) {
        return "Mistral Pixtral";
      } else if (lowerName.includes("large")) {
        return "Mistral Large";
      } else if (lowerName.includes("small")) {
        return "Mistral Small";
      } else if (lowerName.includes("mixtral") && (lowerName.includes("8x7b") || lowerName.includes("8-7"))) {
        return "Mistral Mixtral 8x7B";
      } else if (lowerName.includes("7b") || lowerName.includes("-7-")) {
        return "Mistral 7B";
      } else if (lowerName.includes("mixtral")) {
        return "Mistral Mixtral";
      }
      return "Mistral";
    }

    // Titan variants
    if (lowerName.includes("titan")) {
      if (lowerName.includes("image")) {
        return "Titan Image Generator";
      } else if (lowerName.includes("text") && lowerName.includes("premier")) {
        return "Titan Text Premier";
      } else if (lowerName.includes("text") && (lowerName.includes("express") || lowerName.includes("v1"))) {
        return "Titan Text Express";
      } else if (lowerName.includes("text") && lowerName.includes("lite")) {
        return "Titan Text Lite";
      } else if (lowerName.includes("text")) {
        return "Titan Text";
      } else if (lowerName.includes("embed")) {
        return "Titan Embeddings";
      }
      return "Titan";
    }

    // Nova variants
    if (lowerName.includes("nova")) {
      if (lowerName.includes("lite")) {
        return "Nova Lite";
      } else if (lowerName.includes("reel")) {
        return "Nova Reel";
      } else if (lowerName.includes("canvas")) {
        return "Nova Canvas";
      } else if (lowerName.includes("sonic")) {
        return "Nova Sonic";
      } else if (lowerName.includes("pro")) {
        return "Nova Pro";
      } else if (lowerName.includes("micro")) {
        return "Nova Micro";
      }
      return "Nova";
    }

    // Other models
    if (lowerName.includes("whisper")) {
      return "Whisper";
    }
    if (lowerName.includes("stable") && lowerName.includes("diffusion")) {
      return "Stable Diffusion";
    }

    // Default: return original name
    return modelName;
  }

  /**
   * Filter models to keep only the latest version of each model family.
   * Groups models by their readable name and keeps the one with the highest version/date.
   */
  static filterLatestModels<T extends { provider: string; name: string }>(
    models: T[]
  ): T[] {
    const modelFamilies = new Map<string, T>();

    models.forEach(model => {
      const readableName = this.getReadableModelName(model.name);
      const existing = modelFamilies.get(readableName);

      if (!existing) {
        modelFamilies.set(readableName, model);
      } else {
        // Compare versions - prefer higher version numbers and more recent dates
        const currentVersion = this.extractVersionInfo(model.name);
        const existingVersion = this.extractVersionInfo(existing.name);

        // Compare by version first, then by date
        if (currentVersion.version > existingVersion.version ||
            (currentVersion.version === existingVersion.version && 
             currentVersion.date > existingVersion.date)) {
          modelFamilies.set(readableName, model);
        }
      }
    });

    return Array.from(modelFamilies.values());
  }

  /**
   * Extract version and date information from a model name for comparison.
   */
  static extractVersionInfo(modelName: string): { version: number; date: number } {
    const lowerName = modelName.toLowerCase();
    
    // Extract version numbers (e.g., v1, v2, -v1:0, etc.)
    const versionMatch = lowerName.match(/[v-](\d+)(?:[:\.]|$)/);
    const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;

    // Extract date (e.g., 20241022, 20240620)
    const dateMatch = lowerName.match(/(\d{8})/);
    const date = dateMatch ? parseInt(dateMatch[1], 10) : 0;

    return { version, date };
  }

  /**
   * Check if a model is in the allowed list.
   * Only specific models are shown to keep the list clean.
   */
  static isAllowedModel(modelName: string): boolean {
    const lowerName = modelName.toLowerCase();
    
    // Claude: Only allow 3.7 Sonnet and 4.5 Sonnet
    if (lowerName.includes("claude")) {
      const isAllowedClaude = 
        /3-7-sonnet|3\.7-sonnet|claude-3-7-sonnet/i.test(lowerName) ||  // Claude 3.7 Sonnet
        /sonnet-4-5|sonnet-4\.5|sonnet4-5|sonnet4\.5/i.test(lowerName);  // Claude Sonnet 4.5
      return isAllowedClaude;
    }
    
    // Llama: Only allow 3.3 and 4 Maverick
    if (lowerName.includes("llama")) {
      const isAllowedLlama = 
        /llama-?3[.-]3|llama3[.-]3/i.test(lowerName) ||  // Llama 3.3
        /llama-?4.*maverick|llama4.*maverick/i.test(lowerName);  // Llama 4 Maverick
      return isAllowedLlama;
    }
    
    // AI21 Jamba: Only allow Jamba (not Mini)
    if (lowerName.includes("jamba")) {
      // Block Jamba Mini, allow regular Jamba
      const isJambaMini = /jamba.*mini|mini.*jamba/i.test(lowerName);
      return !isJambaMini;
    }
    
    // Mistral: Only allow Pixtral Large
    if (lowerName.includes("mistral") || lowerName.includes("mixtral") || lowerName.includes("pixtral")) {
      const isPixtralLarge = /pixtral.*large|pixtral-large/i.test(lowerName);
      return isPixtralLarge;
    }
    
    // Nova: Only allow Nova Pro
    if (lowerName.includes("nova")) {
      const isNovaPro = /nova.*pro|nova-pro/i.test(lowerName);
      return isNovaPro;
    }
    
    // Allow all other models (Titan, etc.)
    return true;
  }

  static getSelectOptionGroupsByUseCase<T extends { provider: string; name: string }>(
    data: T[]
  ): SelectProps.OptionGroup[] {
    // Filter to only allowed models
    const allowedModels = data.filter(model => this.isAllowedModel(model.name));
    
    // Filter to keep only the latest version of each model
    const latestModels = this.filterLatestModels(allowedModels);
    
    console.log(`[Model Filter] Input: ${data.length} models, Allowed: ${allowedModels.length}, Output: ${latestModels.length} models`);
    console.log("[Model Filter] Latest models:", latestModels.map(m => m.name));

    // Define model categories with matching patterns (case-insensitive)
    const categories = [
      {
        label: "Chat & Knowledge",
        description: "for conversation, writing, reasoning, summarizing, and document Q&A",
        patterns: [
          /claude/i,
          /llama/i,
          /jamba/i,
          /mistral/i,
          /pixtral/i,
          /titan.*text/i,
          /nova.*lite/i,
          /nova.*pro/i,
          /nova.*micro/i,
        ],
      },
      {
        label: "Images & Video",
        description: "for generating or understanding pictures and clips",
        patterns: [
          /titan.*image/i,
          /nova.*reel/i,
          /nova.*canvas/i,
          /stable.*diffusion/i,
        ],
      },
      {
        label: "Voice & Audio",
        description: "for speech input/output, transcription, or voice generation",
        patterns: [
          /nova.*sonic/i,
          /whisper/i,
          /audio/i,
          /speech/i,
          /voice/i,
        ],
      },
    ];

    const optionGroups: SelectProps.OptionGroup[] = [];
    const processedModels = new Set<string>();

    categories.forEach(category => {
      const matchingModels: T[] = [];

      latestModels.forEach(model => {
        const modelFullName = `${model.provider}::${model.name}`;
        const modelName = model.name.toLowerCase();
        const modelFullNameLower = modelFullName.toLowerCase();

        // Skip if already processed in a previous category
        if (processedModels.has(modelFullName)) {
          return;
        }

        // Check if the model matches any pattern in this category
        const matches = category.patterns.some(pattern => 
          pattern.test(modelName) || pattern.test(modelFullNameLower)
        );

        if (matches) {
          matchingModels.push(model);
          processedModels.add(modelFullName);
        }
      });

      if (matchingModels.length > 0) {
        // Sort models by readable name alphabetically within the category
        matchingModels.sort((a, b) => {
          const nameA = this.getReadableModelName(a.name);
          const nameB = this.getReadableModelName(b.name);
          return nameA.localeCompare(nameB);
        });

        optionGroups.push({
          label: `${category.label} - ${category.description}`,
          options: matchingModels.map(model => {
            const readableName = this.getReadableModelName(model.name);
            const fullModelId = model.name;
            
            return {
              label: readableName,
              value: `${model.provider}::${model.name}`,
              description: fullModelId, // Show full model ID in lighter text below
            };
          }),
        });
      }
    });

    return optionGroups;
  }
}
