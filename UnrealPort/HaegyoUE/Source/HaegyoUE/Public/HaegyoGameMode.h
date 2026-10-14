#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "HaegyoGameMode.generated.h"

// 저장 · 불러오기 (본 슬롯 + 백업 슬롯: 본 슬롯이 손상되면 백업으로 복구 — 웹 saveSystem 과 같은 정책)
UCLASS()
class HAEGYOUE_API AHaegyoGameMode : public AGameModeBase
{
	GENERATED_BODY()
public:
	AHaegyoGameMode();
	UFUNCTION(BlueprintCallable, Category = "Haegyo") bool SaveGame();
	UFUNCTION(BlueprintCallable, Category = "Haegyo") bool LoadGame(bool bPreferBackup);
	static const FString MainSlot;
	static const FString BackupSlot;
};
