#pragma once
#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "HaegyoSaveGame.generated.h"

// 스키마 버전 + 고정 GUID 기반 저장 (웹 v5 세이브와 직접 호환된다고 가정하지 않는다 — 포팅 가이드 15장)
UCLASS()
class HAEGYOUE_API UHaegyoSaveGame : public USaveGame
{
	GENERATED_BODY()
public:
	static constexpr int32 CurrentSchema = 1;
	UPROPERTY() int32 SchemaVersion = CurrentSchema;
	UPROPERTY() FString Character = TEXT("jihun");
	UPROPERTY() FTransform PlayerTransform;
	UPROPERTY() float Battery = 100.f;
	UPROPERTY() int32 KeyMask = 0;              // 열쇠 5조각: 교무실 · 도서실 · 과학실 · 체육관 · 수영장
	UPROPERTY() TMap<FGuid, float> DoorOpen;
	UPROPERTY() FDateTime SavedAt;
};
